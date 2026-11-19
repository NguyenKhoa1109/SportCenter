package com.sporthub.backend.controller;

import com.sporthub.backend.entity.MembershipPackage;
import com.sporthub.backend.repository.MembershipPackageRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/packages")
@CrossOrigin(origins = "*")
public class PackageController {

    private final MembershipPackageRepository packageRepository;

    PackageController(MembershipPackageRepository packageRepository) {
        this.packageRepository = packageRepository;
    }

    // API 1: Lấy danh sách các gói tập đang ACTIVE (Cho Member / Receptionist)
    @GetMapping
    public ResponseEntity<List<MembershipPackage>> getAllPackages() {
        return ResponseEntity.ok(packageRepository.findByStatus("ACTIVE"));
    }

    // API 2: Tạo mới gói tập (Dành cho Manager)
    @PostMapping
    public ResponseEntity<MembershipPackage> createPackage(
            @RequestBody MembershipPackage newPackage,
            Authentication authentication) {
        boolean isManager = authentication != null && authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .anyMatch(Set.of("ROLE_MANAGER", "ROLE_ADMIN")::contains);
        if (!isManager) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Quản lý mới được tạo gói tập.");
        }
        if (newPackage.getMembershipTier() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ tạo hạng Đồng, Bạc, Vàng hoặc Kim Cương.");
        }
        newPackage.setName(newPackage.getMembershipTier().getDisplayName());
        newPackage.setPackageType(com.sporthub.backend.enums.PackageType.VIP);
        newPackage.setSportId(null);
        if (packageRepository.existsByMembershipTierAndStatusAndPackageIdNot(newPackage.getMembershipTier(), "ACTIVE", -1L)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hạng này đã mở bán. Hãy cập nhật cấu hình hiện có.");
        }
        MembershipPackage saved = packageRepository.save(newPackage);
        return ResponseEntity.ok(saved);
    }
}
