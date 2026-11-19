package com.sporthub.backend.dto;

import java.time.LocalDate;

public record MemberMembershipResponse(
        Long membershipId,
        String packageName,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        Long packageId,
        Long paymentId,
        String paymentMethod,
        com.sporthub.backend.enums.MembershipTier membershipTier) {
}
