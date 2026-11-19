package com.sporthub.backend.dto;

import java.util.List;

public record CreateUserRequest(
        String fullName,
        String email,
        String phone,
        String password,
        String role,
        List<Long> sportIds,
        String specialty
) {
    public CreateUserRequest(
            String fullName,
            String email,
            String phone,
            String password,
            String role) {
        this(fullName, email, phone, password, role, null, null);
    }
}
