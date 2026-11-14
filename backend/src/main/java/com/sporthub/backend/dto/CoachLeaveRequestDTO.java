package com.sporthub.backend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record CoachLeaveRequestDTO(
        Long requestId,
        Long coachId,
        String coachName,
        String leaveType,
        LocalDate startDate,
        LocalDate endDate,
        String reason,
        String status,
        Long approvedBy,
        Integer affectedBookingsCount,
        Long reassignedCoachId,
        LocalDateTime createdAt,
        List<AffectedSessionDTO> affectedSessions) {

    public CoachLeaveRequestDTO(
            Long requestId,
            Long coachId,
            String coachName,
            String leaveType,
            LocalDate startDate,
            LocalDate endDate,
            String reason,
            String status,
            Long approvedBy,
            Integer affectedBookingsCount,
            Long reassignedCoachId,
            LocalDateTime createdAt) {
        this(
                requestId,
                coachId,
                coachName,
                leaveType,
                startDate,
                endDate,
                reason,
                status,
                approvedBy,
                affectedBookingsCount,
                reassignedCoachId,
                createdAt,
                List.of());
    }

    public record AffectedSessionDTO(
            Long sessionId,
            String className,
            Long sportId,
            String sportName,
            LocalDateTime startTime,
            LocalDateTime endTime,
            Integer bookedSlots,
            Integer maxSlots,
            String status) {
    }
}
