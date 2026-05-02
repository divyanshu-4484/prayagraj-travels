package com.travels.service;

import com.travels.model.BookingRequest;
import com.travels.model.SeatHoldRequest;
import com.travels.repository.TravelsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Core business logic for Prayagraj Travels.
 * Redis is used for seat locking (HELD state, TTL = 2 min).
 * MySQL is source of truth for CONFIRMED bookings.
 */
@Service
public class TravelsService {

    private static final Logger log = LoggerFactory.getLogger(TravelsService.class);

    /** Redis TTL for seat hold: 2 minutes */
    private static final long HOLD_TTL_SECONDS = 120L;

    @Autowired
    private TravelsRepository repo;

    @Autowired
    private RedisTemplate<String, Object> redis;

    // ══════════════════════════════════════════════════════════════════════════
    // BUS
    // ══════════════════════════════════════════════════════════════════════════

    public List<Map<String, Object>> getAllBuses() {
        return repo.findAllBuses();
    }

    public Map<String, Object> getBusById(Long id) {
        Map<String, Object> bus = repo.findBusById(id);
        if (bus == null) throw new NoSuchElementException("Bus not found: " + id);
        return bus;
    }

    /**
     * Case-insensitive search for buses matching source & destination.
     */
    public List<Map<String, Object>> searchBuses(String source, String destination) {
        if (source == null || source.isBlank() || destination == null || destination.isBlank()) {
            throw new IllegalArgumentException("source and destination are required");
        }
        return repo.searchBuses(source.trim(), destination.trim());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SEAT MAP
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Returns full seat map with AVAILABLE / BOOKED / HELD status.
     * Total seats determined from the bus record.
     */
    public Map<String, Object> getSeatMap(Long busId, String travelDate) {
        Map<String, Object> bus = getBusById(busId);
        int totalSeats = ((Number) bus.get("capacity")).intValue();

        // DB-confirmed bookings
        List<String> bookedSeats = repo.findBookedSeats(busId, travelDate);

        // Redis-held seats (degrade gracefully if Redis is unavailable)
        Set<String> heldSeats = new HashSet<>();
        try {
            String pattern = redisHoldKey(busId, "*", travelDate);
            Set<String> heldKeys = redis.keys(pattern);
            if (heldKeys != null) {
                for (String key : heldKeys) {
                    // key format: seat:hold:{busId}:{seatNumber}:{date}
                    String[] parts = key.split(":");
                    if (parts.length >= 5) heldSeats.add(parts[3]);
                }
            }
        } catch (Exception e) {
            log.warn("Redis unavailable for seat hold lookup, continuing without held seats: {}", e.getMessage());
        }

        // Build seat list
        List<Map<String, Object>> seats = new ArrayList<>();
        for (int i = 1; i <= totalSeats; i++) {
            String seatNum = generateSeatId(i, totalSeats);
            String status;
            if (bookedSeats.contains(seatNum))      status = "BOOKED";
            else if (heldSeats.contains(seatNum))   status = "HELD";
            else                                     status = "AVAILABLE";

            Map<String, Object> seat = new LinkedHashMap<>();
            seat.put("seatNumber", seatNum);
            seat.put("status", status);
            seats.add(seat);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("busId", busId);
        response.put("busName", bus.get("name"));
        response.put("travelDate", travelDate);
        response.put("totalSeats", totalSeats);
        response.put("availableCount",
                seats.stream().filter(s -> "AVAILABLE".equals(s.get("status"))).count());
        response.put("seats", seats);
        return response;
    }

    /**
     * Seat ID uses row-letter + number within that row.
     * Layout: 2 seats | aisle | 2 seats (standard 2+2).
     */
    private String generateSeatId(int index, int total) {
        int seatsPerRow = 4;
        int row   = (index - 1) / seatsPerRow;
        int col   = (index - 1) % seatsPerRow;
        char letter = (char) ('A' + row);
        int colNum  = col + 1;
        return letter + String.valueOf(colNum);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SEAT HOLD (Redis)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Atomically holds a seat in Redis for 2 minutes.
     * Returns false if already held or booked.
     */
    public Map<String, Object> holdSeat(SeatHoldRequest req) {
        validateHoldRequest(req);

        // 1. Check DB (CONFIRMED booking)
        if (repo.isSeatBooked(req.getBusId(), req.getSeatNumber(), req.getTravelDate())) {
            return errorResponse("SEAT_BOOKED", "This seat is already confirmed by another passenger.");
        }

        // 2. Try atomic Redis set-if-absent
        String key = redisHoldKey(req.getBusId(), req.getSeatNumber(), req.getTravelDate());
        Boolean acquired = redis.opsForValue()
                .setIfAbsent(key, req.getUserId(), HOLD_TTL_SECONDS, TimeUnit.SECONDS);

        if (Boolean.TRUE.equals(acquired)) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("success", true);
            res.put("message", "Seat held for 2 minutes. Complete payment to confirm.");
            res.put("seatNumber", req.getSeatNumber());
            res.put("holdExpiresInSeconds", HOLD_TTL_SECONDS);
            return res;
        } else {
            // Already held — check if held by same user
            Object holder = redis.opsForValue().get(key);
            if (req.getUserId().equals(holder)) {
                // Refresh TTL
                redis.expire(key, HOLD_TTL_SECONDS, TimeUnit.SECONDS);
                Long ttl = redis.getExpire(key, TimeUnit.SECONDS);
                Map<String, Object> res = new LinkedHashMap<>();
                res.put("success", true);
                res.put("message", "Seat hold refreshed.");
                res.put("seatNumber", req.getSeatNumber());
                res.put("holdExpiresInSeconds", ttl);
                return res;
            }
            return errorResponse("SEAT_HELD", "Seat is temporarily held by another user. Try after 2 minutes.");
        }
    }

    /**
     * Releases a Redis hold (user deselects seat).
     */
    public Map<String, Object> releaseSeat(SeatHoldRequest req) {
        validateHoldRequest(req);
        String key = redisHoldKey(req.getBusId(), req.getSeatNumber(), req.getTravelDate());
        Object holder = redis.opsForValue().get(key);
        if (req.getUserId().equals(holder)) {
            redis.delete(key);
            return successResponse("Seat released successfully.");
        }
        return errorResponse("NOT_YOUR_HOLD", "You do not hold this seat.");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BOOKING (MySQL confirmation)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Confirms booking:
     * 1. Verify Redis hold belongs to this user.
     * 2. Verify not booked in DB.
     * 3. Insert booking record.
     * 4. Delete Redis hold.
     */
    public Map<String, Object> confirmBooking(BookingRequest req) {
        validateBookingRequest(req);

        String redisKey = redisHoldKey(req.getBusId(), req.getSeatNumber(), req.getTravelDate());

        // 1. Check Redis hold
        Object holder = redis.opsForValue().get(redisKey);
        if (holder == null) {
            return errorResponse("HOLD_EXPIRED",
                    "Your seat hold has expired. Please select the seat again.");
        }
        if (!req.getUserId().equals(holder.toString())) {
            return errorResponse("NOT_YOUR_HOLD",
                    "Seat is held by a different user.");
        }

        // 2. Double-check DB (race condition guard)
        if (repo.isSeatBooked(req.getBusId(), req.getSeatNumber(), req.getTravelDate())) {
            redis.delete(redisKey);
            return errorResponse("ALREADY_BOOKED",
                    "Seat was just confirmed by another booking. Please choose another seat.");
        }

        // 3. Fetch fare
        Map<String, Object> bus = repo.findBusById(req.getBusId());
        double fare = bus != null ? ((Number) bus.get("fare")).doubleValue() : 0.0;

        // 4. Insert booking
        long bookingId = repo.confirmBooking(
                req.getBusId(), req.getSeatNumber(), req.getTravelDate(),
                req.getUserId(), req.getPassengerName(),
                req.getPassengerPhone(), fare);

        // 5. Release Redis hold
        redis.delete(redisKey);

        // 6. Return booking details
        Map<String, Object> booking = repo.findBookingById(bookingId);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "🎉 Booking confirmed!");
        res.put("bookingId", bookingId);
        res.put("booking", booking);
        return res;
    }

    public List<Map<String, Object>> getBookingsByUser(String userId) {
        return repo.findBookingsByUser(userId);
    }

    public Map<String, Object> cancelBooking(long bookingId, String userId) {
        boolean cancelled = repo.cancelBooking(bookingId, userId);
        if (cancelled) return successResponse("Booking cancelled successfully.");
        return errorResponse("NOT_FOUND", "Booking not found or already cancelled.");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIVE LOCATION
    // ══════════════════════════════════════════════════════════════════════════

    public Map<String, Object> getLiveLocation(Long busId) {
        Map<String, Object> loc = repo.findLiveLocation(busId);
        if (loc == null) throw new NoSuchElementException("Live location not found for bus: " + busId);
        return loc;
    }

    public List<Map<String, Object>> getAllLiveLocations() {
        return repo.findAllLiveLocations();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private String redisHoldKey(Long busId, String seatNumber, String date) {
        return "seat:hold:" + busId + ":" + seatNumber + ":" + date;
    }

    private Map<String, Object> successResponse(String message) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", message);
        return res;
    }

    private Map<String, Object> errorResponse(String code, String message) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", false);
        res.put("errorCode", code);
        res.put("message", message);
        return res;
    }

    private void validateHoldRequest(SeatHoldRequest req) {
        if (req.getBusId() == null || req.getSeatNumber() == null ||
                req.getTravelDate() == null || req.getUserId() == null) {
            throw new IllegalArgumentException("busId, seatNumber, travelDate, userId are required");
        }
    }

    private void validateBookingRequest(BookingRequest req) {
        if (req.getBusId() == null || req.getSeatNumber() == null ||
                req.getTravelDate() == null || req.getUserId() == null) {
            throw new IllegalArgumentException("busId, seatNumber, travelDate, userId are required");
        }
    }
}
