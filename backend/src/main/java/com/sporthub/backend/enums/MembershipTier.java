package com.sporthub.backend.enums;

public enum MembershipTier {
    BRONZE("Hạng Đồng"), SILVER("Hạng Bạc"), GOLD("Hạng Vàng"), DIAMOND("Hạng Kim Cương");

    private final String displayName;

    MembershipTier(String displayName) { this.displayName = displayName; }

    public String getDisplayName() { return displayName; }
}
