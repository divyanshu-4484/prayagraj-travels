package com.travels.repository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

/**
 * All MySQL operations via JDBC Template (no JPA).
 */
@Repository
public class TravelsRepository {

    private static final Logger log = LoggerFactory.getLogger(TravelsRepository.class);

    @Autowired
    private JdbcTemplate jdbc;

    // ══════════════════════════════════════════════════════════════════════════
    // BUS QUERIES
    // ══════════════════════════════════════════════════════════════════════════

    public List<Map<String, Object>> findAllBuses() {
        String sql = "SELECT * FROM buses ORDER BY id";
        return jdbc.queryForList(sql);
    }

    public Map<String, Object> findBusById(Long busId) {
        String sql = "SELECT * FROM buses WHERE id = ?";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, busId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Case-insensitive search by source + destination.
     */
    public List<Map<String, Object>> searchBuses(String source, String destination) {
        String sql = """
                SELECT * FROM buses
                WHERE LOWER(source) LIKE LOWER(CONCAT('%', ?, '%'))
                  AND LOWER(destination) LIKE LOWER(CONCAT('%', ?, '%'))
                ORDER BY id
                """;
        return jdbc.queryForList(sql, source, destination);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SEAT QUERIES
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Returns all BOOKED seats for a given bus + date from MySQL.
     */
    public List<String> findBookedSeats(Long busId, String travelDate) {
        String sql = """
                SELECT seat_number
                FROM bookings
                WHERE bus_id = ?
                  AND travel_date = ?
                  AND status = 'CONFIRMED'
                """;
        return jdbc.queryForList(sql, String.class, busId, travelDate);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BOOKING OPERATIONS
    // ══════════════════════════════════════════════════════════════════════════

    public boolean isSeatBooked(Long busId, String seatNumber, String travelDate) {
        String sql = """
                SELECT COUNT(*) FROM bookings
                WHERE bus_id = ? AND seat_number = ? AND travel_date = ?
                  AND status = 'CONFIRMED'
                """;
        Integer count = jdbc.queryForObject(sql, Integer.class, busId, seatNumber, travelDate);
        return count != null && count > 0;
    }

    /**
     * Inserts a confirmed booking. Returns the generated booking_id.
     */
    public long confirmBooking(Long busId, String seatNumber, String travelDate,
                               String userId, String passengerName,
                               String passengerPhone, double farePaid) {
        String sql = """
                INSERT INTO bookings
                    (bus_id, seat_number, travel_date, user_id, passenger_name, passenger_phone, status, fare_paid)
                VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
                """;
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, busId);
            ps.setString(2, seatNumber);
            ps.setString(3, travelDate);
            ps.setString(4, userId);
            ps.setString(5, passengerName != null ? passengerName : "Passenger");
            ps.setString(6, passengerPhone);
            ps.setDouble(7, farePaid);
            return ps;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    public Map<String, Object> findBookingById(long bookingId) {
        String sql = "SELECT * FROM bookings WHERE booking_id = ?";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, bookingId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> findBookingsByUser(String userId) {
        String sql = """
                SELECT bk.*, b.name as bus_name, b.source, b.destination
                FROM bookings bk
                JOIN buses b ON bk.bus_id = b.id
                WHERE bk.user_id = ?
                ORDER BY bk.booked_at DESC
                """;
        return jdbc.queryForList(sql, userId);
    }

    public boolean cancelBooking(long bookingId, String userId) {
        String sql = """
                UPDATE bookings SET status = 'CANCELLED'
                WHERE booking_id = ? AND user_id = ? AND status = 'CONFIRMED'
                """;
        int rows = jdbc.update(sql, bookingId, userId);
        return rows > 0;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIVE LOCATION
    // ══════════════════════════════════════════════════════════════════════════

    public Map<String, Object> findLiveLocation(Long busId) {
        String sql = """
                SELECT l.*, b.name as bus_name, b.source, b.destination
                FROM bus_live_location l
                JOIN buses b ON l.bus_id = b.id
                WHERE l.bus_id = ?
                """;
        List<Map<String, Object>> rows = jdbc.queryForList(sql, busId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> findAllLiveLocations() {
        String sql = """
                SELECT l.*, b.name as bus_name, b.source, b.destination
                FROM bus_live_location l
                JOIN buses b ON l.bus_id = b.id
                ORDER BY l.bus_id
                """;
        return jdbc.queryForList(sql);
    }

    public void updateLiveLocation(Long busId, double lat, double lng,
                                   int speedKmh, int heading, String nextStop, String status) {
        String sql = """
                INSERT INTO bus_live_location (bus_id, latitude, longitude, speed_kmh, heading_degrees, next_stop, status)
                VALUES (?, ?, ?, ?, ?, ?, ?) AS new_val
                ON DUPLICATE KEY UPDATE
                latitude = new_val.latitude, longitude = new_val.longitude, speed_kmh = new_val.speed_kmh,
                heading_degrees = new_val.heading_degrees, next_stop = new_val.next_stop, status = new_val.status,
                last_updated = NOW()
                """;
        jdbc.update(sql, busId, lat, lng, speedKmh, heading, nextStop, status);
    }
}
