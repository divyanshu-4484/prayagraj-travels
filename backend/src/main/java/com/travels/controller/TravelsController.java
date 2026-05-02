package com.travels.controller;

import com.travels.model.BookingRequest;
import com.travels.model.SeatHoldRequest;
import com.travels.service.TravelsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/travels")
public class TravelsController {

    private static final Logger log = LoggerFactory.getLogger(TravelsController.class);

    @Autowired
    private TravelsService travelsService;

    // ── Health ────────────────────────────────────────────────────────────────

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Prayagraj Travels API",
                "version", "1.0.0"));
    }

    // ── Bus ──────────────────────────────────────────────────────────────────

    @GetMapping("/buses")
    public ResponseEntity<List<Map<String, Object>>> getAllBuses() {
        return ResponseEntity.ok(travelsService.getAllBuses());
    }

    @GetMapping("/buses/{id}")
    public ResponseEntity<?> getBusById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(travelsService.getBusById(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── Search ────────────────────────────────────────────────────────────────

    /**
     * GET /api/travels/search?source=Civil+Lines&destination=Naini
     */
    @GetMapping("/search")
    public ResponseEntity<?> searchBuses(
            @RequestParam String source,
            @RequestParam String destination) {
        try {
            List<Map<String, Object>> results = travelsService.searchBuses(source, destination);
            return ResponseEntity.ok(Map.of(
                    "source", source,
                    "destination", destination,
                    "count", results.size(),
                    "buses", results));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Seat Map ─────────────────────────────────────────────────────────────

    /**
     * GET /api/travels/seats?busId=1&travelDate=2024-12-25
     */
    @GetMapping("/seats")
    public ResponseEntity<?> getSeatMap(
            @RequestParam Long busId,
            @RequestParam String travelDate) {
        try {
            return ResponseEntity.ok(travelsService.getSeatMap(busId, travelDate));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── Seat Hold ────────────────────────────────────────────────────────────

    /**
     * POST /api/travels/seats/hold
     * Body: { busId, seatNumber, travelDate, userId }
     */
    @PostMapping("/seats/hold")
    public ResponseEntity<Map<String, Object>> holdSeat(@RequestBody SeatHoldRequest req) {
        Map<String, Object> result = travelsService.holdSeat(req);
        boolean success = Boolean.TRUE.equals(result.get("success"));
        return ResponseEntity.status(success ? HttpStatus.OK : HttpStatus.CONFLICT).body(result);
    }

    /**
     * POST /api/travels/seats/release
     */
    @PostMapping("/seats/release")
    public ResponseEntity<Map<String, Object>> releaseSeat(@RequestBody SeatHoldRequest req) {
        Map<String, Object> result = travelsService.releaseSeat(req);
        return ResponseEntity.ok(result);
    }

    // ── Booking ───────────────────────────────────────────────────────────────

    /**
     * POST /api/travels/book
     * Body: { busId, seatNumber, travelDate, userId, passengerName, passengerPhone
     * }
     */
    @PostMapping("/book")
    public ResponseEntity<Map<String, Object>> confirmBooking(@RequestBody BookingRequest req) {
        Map<String, Object> result = travelsService.confirmBooking(req);
        boolean success = Boolean.TRUE.equals(result.get("success"));
        return ResponseEntity.status(success ? HttpStatus.CREATED : HttpStatus.CONFLICT).body(result);
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<Map<String, Object>>> getBookingsByUser(@RequestParam String userId) {
        return ResponseEntity.ok(travelsService.getBookingsByUser(userId));
    }

    @DeleteMapping("/bookings/{bookingId}")
    public ResponseEntity<Map<String, Object>> cancelBooking(
            @PathVariable long bookingId,
            @RequestParam String userId) {
        return ResponseEntity.ok(travelsService.cancelBooking(bookingId, userId));
    }

    // ── Live Location ─────────────────────────────────────────────────────────

    /**
     * GET /api/travels/live-location?busId=1
     */
    @GetMapping("/live-location")
    public ResponseEntity<?> getLiveLocation(@RequestParam Long busId) {
        try {
            return ResponseEntity.ok(travelsService.getLiveLocation(busId));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/live-location/all")
    public ResponseEntity<List<Map<String, Object>>> getAllLiveLocations() {
        return ResponseEntity.ok(travelsService.getAllLiveLocations());
    }

    // ── Global Exception Handler ──────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "success", false,
                        "error", "Internal server error",
                        "detail", e.getMessage()));
    }
}
