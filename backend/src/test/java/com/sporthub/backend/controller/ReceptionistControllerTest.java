package com.sporthub.backend.controller;

import static org.mockito.Mockito.lenient;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.sporthub.backend.constants.PaymentConstants;
import com.sporthub.backend.entity.PaymentTransaction;
import com.sporthub.backend.entity.ReceptionPayment;
import com.sporthub.backend.entity.User;
import com.sporthub.backend.repository.MemberCheckInRepository;
import com.sporthub.backend.repository.MembershipPackageRepository;
import com.sporthub.backend.repository.PaymentTransactionRepository;
import com.sporthub.backend.repository.ReceptionPaymentRepository;
import com.sporthub.backend.repository.UserMembershipRepository;
import com.sporthub.backend.repository.UserRepository;

class ReceptionistControllerTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final ReceptionPaymentRepository paymentRepository = mock(ReceptionPaymentRepository.class);
    private final PaymentTransactionRepository paymentTransactionRepository =
            mock(PaymentTransactionRepository.class);
    private final UserMembershipRepository membershipRepository = mock(UserMembershipRepository.class);
    private final MembershipPackageRepository packageRepository = mock(MembershipPackageRepository.class);
    private final MemberCheckInRepository checkInRepository = mock(MemberCheckInRepository.class);
    private final com.sporthub.backend.service.EmailService emailService = mock(com.sporthub.backend.service.EmailService.class);
    private final com.sporthub.backend.service.AuditLogService auditLogService = mock(com.sporthub.backend.service.AuditLogService.class);
    private final com.sporthub.backend.service.AuthService authService = mock(com.sporthub.backend.service.AuthService.class);
    private final ReceptionistController controller = new ReceptionistController(
            userRepository,
            paymentRepository,
            paymentTransactionRepository,
            membershipRepository,
            packageRepository,
            checkInRepository,
            new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(),
            emailService,
            auditLogService,
            authService);
    private final UsernamePasswordAuthenticationToken receptionist =
            new UsernamePasswordAuthenticationToken(
                    "3", "", List.of(new SimpleGrantedAuthority("ROLE_RECEPTIONIST")));

    @Test
    void eligibilityPreviewReturnsReasonFromAdmissionValidation() {
        var service = mock(com.sporthub.backend.service.CheckInService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "checkInService", service);
        when(userRepository.findById(9L)).thenReturn(java.util.Optional.of(
                User.builder().userId(9L).role("MEMBER").status("ACTIVE").build()));
        org.mockito.Mockito.doThrow(new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT, "Chưa đúng giờ hoặc lịch đã kết thúc."))
                .when(service).validateCheckIn(9L, null);

        var result = controller.checkInEligibility(9L, null, receptionist);

        assertEquals(false, result.get("eligible"));
        assertEquals("Chưa đúng giờ hoặc lịch đã kết thúc.", result.get("reason"));
        org.mockito.Mockito.verify(checkInRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void eligibilityPreviewAllowsPaidBookingWithoutLookingForMembership() {
        var service = mock(com.sporthub.backend.service.CheckInService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "checkInService", service);
        when(userRepository.findById(9L)).thenReturn(java.util.Optional.of(
                User.builder().userId(9L).role("MEMBER").status("ACTIVE").build()));

        var result = controller.checkInEligibility(9L, 25L, receptionist);

        assertEquals(true, result.get("eligible"));
        org.mockito.Mockito.verify(service).validateCheckIn(9L, 25L);
        org.mockito.Mockito.verifyNoInteractions(membershipRepository, checkInRepository);
    }

    @Test
    void receptionEndpointRejectsCheckInWhenBookingValidationFails() {
        var checkInService = mock(com.sporthub.backend.service.CheckInService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "checkInService", checkInService);
        User member = User.builder().userId(9L).role("MEMBER").status("ACTIVE").build();
        var membership = new com.sporthub.backend.entity.UserMembership();
        membership.setStatus("ACTIVE");
        membership.setStartDate(LocalDate.now().minusDays(1));
        membership.setEndDate(LocalDate.now().plusDays(10));
        lenient().when(userRepository.findById(9L)).thenReturn(java.util.Optional.of(member));
        lenient().when(userRepository.findByIdForUpdate(9L)).thenReturn(java.util.Optional.of(member));
        when(membershipRepository.findByUserIdOrderByEndDateDesc(9L)).thenReturn(List.of(membership));
        org.mockito.Mockito.doThrow(new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT, "No valid booking"))
                .when(checkInService).checkInBooking(9L, null);
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> controller.recordCheckIn(new com.sporthub.backend.dto.ReceptionistCheckInRequest(9L), receptionist));
        org.mockito.Mockito.verify(checkInRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void memberSearchReturnsPaginatedMemberSummariesWithAvatarRfidAndPackages() {
        User member = User.builder()
                .userId(9L)
                .fullName("Nguyễn Anh Khoa")
                .email("member@example.com")
                .phone("0900000000")
                .status("ACTIVE")
                .avatar("https://example.com/avatar-khoa.jpg")
                .rfidCode("RFID-SH-0009")
                .build();
        var membership = new com.sporthub.backend.entity.UserMembership();
        membership.setMembershipId(41L);
        membership.setUserId(9L);
        membership.setPackageId(7L);
        membership.setStartDate(LocalDate.now().minusDays(3));
        membership.setEndDate(LocalDate.now().plusDays(27));
        membership.setStatus("ACTIVE");
        membership.setRemainingQuotaSessions(5);
        membership.setRemainingQuotaCourts(3);
        var pkg = com.sporthub.backend.entity.MembershipPackage.builder()
                .packageId(7L)
                .name("Gói Vàng All-Access")
                .build();

        when(userRepository.searchMembers(eq("Khoa"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(member), PageRequest.of(0, 20), 1));
        when(membershipRepository.findByUserIdInOrderByEndDateDesc(List.of(9L)))
                .thenReturn(List.of(membership));
        when(packageRepository.findAllById(java.util.Set.of(7L)))
                .thenReturn(List.of(pkg));

        var result = controller.searchMembers("Khoa", 0, 20, receptionist);

        assertEquals(1, result.getTotalElements());
        var row = result.getContent().get(0);
        assertEquals("Nguyễn Anh Khoa", row.fullName());
        assertEquals("https://example.com/avatar-khoa.jpg", row.avatar());
        assertEquals("RFID-SH-0009", row.rfidCode());
        assertEquals("Gói Vàng All-Access", row.activePackageName());
        assertEquals(5, row.remainingQuotaSessions());
        assertEquals(1, row.activePackages().size());
    }

    @Test
    void reportSumsCompletedPaymentsAcrossBothPaymentTables() {
        LocalDate reportDate = LocalDate.of(2026, 10, 13);
        LocalDateTime createdAt = reportDate.atTime(9, 30);
        ReceptionPayment membershipPayment = new ReceptionPayment();
        membershipPayment.setPaymentId(1);
        membershipPayment.setMemberId(9);
        membershipPayment.setAmount(new BigDecimal("100000"));
        membershipPayment.setPaymentMethod("CASH");
        membershipPayment.setPaymentStatus("COMPLETED");
        membershipPayment.setCreatedAt(createdAt);
        ReceptionPayment pendingPayment = new ReceptionPayment();
        pendingPayment.setPaymentId(2);
        pendingPayment.setMemberId(9);
        pendingPayment.setAmount(new BigDecimal("500000"));
        pendingPayment.setPaymentMethod("POS");
        pendingPayment.setPaymentStatus("PENDING");
        pendingPayment.setCreatedAt(createdAt.plusMinutes(1));

        PaymentTransaction bookingPayment = new PaymentTransaction();
        bookingPayment.setPaymentId(3L);
        bookingPayment.setMemberId(9L);
        bookingPayment.setAmount(new BigDecimal("200000"));
        bookingPayment.setPaymentMethod(PaymentConstants.METHOD_VNPAY);
        bookingPayment.setPaymentStatus("PAID");
        bookingPayment.setCreatedAt(createdAt.plusMinutes(2));

        PaymentTransaction quotaBooking = new PaymentTransaction();
        quotaBooking.setPaymentId(4L);
        quotaBooking.setMemberId(9L);
        quotaBooking.setAmount(BigDecimal.ZERO);
        quotaBooking.setPaymentMethod(PaymentConstants.METHOD_MEMBERSHIP_QUOTA);
        quotaBooking.setPaymentStatus("PAID");
        quotaBooking.setCreatedAt(createdAt.plusMinutes(3));

        User member = User.builder().userId(9L).fullName("Nguyễn Anh Khoa").build();
        when(paymentRepository
                .findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        reportDate.atStartOfDay(), reportDate.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(pendingPayment, membershipPayment));
        when(paymentTransactionRepository
                .findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        reportDate.atStartOfDay(), reportDate.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(bookingPayment, quotaBooking));
        when(userRepository.findAllById(List.of(9L))).thenReturn(List.of(member));
        when(userRepository.countByRoleIgnoreCaseAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                "MEMBER", reportDate.atStartOfDay(), reportDate.plusDays(1).atStartOfDay()))
                .thenReturn(1L);

        var result = controller.getDailyReport(reportDate, receptionist);

        assertEquals(new BigDecimal("300000"), result.totalRevenue());
        assertEquals(2, result.completedPayments());
        assertEquals(1, result.newMembers());
        assertEquals(3, result.payments().size());
        assertEquals(2, result.paymentMethods().size());
    }

    @Test
    void getMyProfileReturnsReceptionistProfileAndStats() {
        User staff = User.builder()
                .userId(3L)
                .fullName("Phạm Minh Tú")
                .email("tu.receptionist@sporthub.vn")
                .phone("0912345678")
                .role("RECEPTIONIST")
                .status("ACTIVE")
                .build();
        lenient().when(userRepository.findById(3L)).thenReturn(java.util.Optional.of(staff));
        lenient().when(userRepository.findByIdForUpdate(3L)).thenReturn(java.util.Optional.of(staff));
        when(checkInRepository.countByRecordedBy(3L)).thenReturn(42L);

        var res = controller.getMyProfile(receptionist);

        assertEquals("Phạm Minh Tú", res.fullName());
        assertEquals("F-STAFF-003", res.staffCode());
        assertEquals("Nhân viên Lễ tân", res.roleTitle());
        assertEquals(42L, res.shiftStats().totalCheckInsHandled());
    }

    @Test
    void updateMyProfileUpdatesDetails() {
        User staff = User.builder()
                .userId(3L)
                .fullName("Phạm Minh Tú")
                .email("tu.receptionist@sporthub.vn")
                .phone("0912345678")
                .role("RECEPTIONIST")
                .status("ACTIVE")
                .build();
        lenient().when(userRepository.findById(3L)).thenReturn(java.util.Optional.of(staff));
        lenient().when(userRepository.findByIdForUpdate(3L)).thenReturn(java.util.Optional.of(staff));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new com.sporthub.backend.dto.ReceptionistProfileUpdateRequest(
                "Phạm Minh Tú Updated",
                "0988888888",
                LocalDate.of(1995, 1, 1),
                "Nam",
                "Quận 1, TP. HCM",
                "Người thân",
                "0999999999"
        );
        var res = controller.updateMyProfile(req, receptionist);

        assertEquals("Phạm Minh Tú Updated", res.fullName());
        assertEquals("0988888888", res.phone());
        assertEquals("Quận 1, TP. HCM", res.address());
    }

    @Test
    void updateMyAvatarSetsAvatar() {
        User staff = User.builder()
                .userId(3L)
                .fullName("Phạm Minh Tú")
                .role("RECEPTIONIST")
                .status("ACTIVE")
                .build();
        lenient().when(userRepository.findById(3L)).thenReturn(java.util.Optional.of(staff));
        lenient().when(userRepository.findByIdForUpdate(3L)).thenReturn(java.util.Optional.of(staff));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var res = controller.updateMyAvatar(new ReceptionistController.AvatarUpdateRequest("data:image/jpeg;base64,newavatar"), receptionist);
        assertEquals(true, res.get("ok"));
        assertEquals("data:image/jpeg;base64,newavatar", res.get("avatar"));
    }

    @Test
    void receptionistCanOnlyCreateMemberUserAndCannotCreateStaffRoles() {
        when(authService.findUserByEmail("member.rec@example.com")).thenReturn(java.util.Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            saved.setUserId(88L);
            return saved;
        });

        for (String forbiddenRole : List.of("COACH", "RECEPTIONIST", "MANAGER", "ADMIN")) {
            var forbiddenReq = new com.sporthub.backend.dto.CreateUserRequest(
                    "Nhân sự Bị Chặn", "blocked." + forbiddenRole.toLowerCase() + "@example.com",
                    "0912345679", "SportHub@123", forbiddenRole);
            when(authService.findUserByEmail(forbiddenReq.email())).thenReturn(java.util.Optional.empty());
            var ex = org.junit.jupiter.api.Assertions.assertThrows(
                    org.springframework.web.server.ResponseStatusException.class,
                    () -> controller.createUser(forbiddenReq, receptionist));
            assertEquals(403, ex.getStatusCode().value());
        }

        var validMember = new com.sporthub.backend.dto.CreateUserRequest(
                "Hội Viên Quầy", "member.rec@example.com", "0912345679", "SportHub@123", "MEMBER");
        var res = controller.createUser(validMember, receptionist);
        assertEquals(88L, res.userId());
        assertEquals("Hội Viên Quầy", res.fullName());
        org.mockito.Mockito.verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(
                u -> "MEMBER".equals(u.getRole()) && "ACTIVE".equals(u.getStatus())));
    }

    @Test
    void enrollAndCancelClassDelegationWorksForReceptionist() {
        var bookingService = mock(com.sporthub.backend.service.BookingService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "bookingService", bookingService);

        var confirm = new com.sporthub.backend.dto.BookingConfirmationResponse(
                "CLASS", 301L, 401L, "Yoga Sáng", "Yoga", "Phòng A1",
                LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(1).plusHours(1),
                new BigDecimal("120000"), "PAID", "CLS-REC-301");
        when(bookingService.enrollMemberInClassByReceptionist(22L, 9L, "CASH", false, null, 3L, "RECEPTIONIST"))
                .thenReturn(confirm);

        var enrolled = controller.enrollMemberInClass(
                22L,
                new ReceptionistController.ReceptionistClassEnrollRequest(9L, "CASH", false, null),
                receptionist);
        assertEquals(301L, enrolled.bookingId());
        assertEquals("PAID", enrolled.paymentStatus());

        var cancelResp = com.sporthub.backend.dto.CancelBookingResponse.builder()
                .bookingId(301L).status("CANCELLED").refunded(true).build();
        when(bookingService.cancelClassBookingByStaff(301L, 3L, "RECEPTIONIST")).thenReturn(cancelResp);

        var cancelled = controller.cancelMemberClassBooking(301L, receptionist);
        assertEquals("CANCELLED", cancelled.getStatus());
    }

    @Test
    void reportIncludesReturnedPaidEquipmentLoansAcrossCashAndVnpay() {
        var equipmentLoanRepository = mock(com.sporthub.backend.repository.EquipmentLoanRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "equipmentLoanRepository", equipmentLoanRepository);

        LocalDate reportDate = LocalDate.of(2026, 10, 13);
        LocalDateTime start = reportDate.atStartOfDay();
        LocalDateTime end = reportDate.plusDays(1).atStartOfDay();

        ReceptionPayment membershipPayment = new ReceptionPayment();
        membershipPayment.setPaymentId(1);
        membershipPayment.setMemberId(9);
        membershipPayment.setAmount(new BigDecimal("100000"));
        membershipPayment.setPaymentMethod("CASH");
        membershipPayment.setPaymentStatus("COMPLETED");
        membershipPayment.setCreatedAt(reportDate.atTime(9, 30));

        var cashLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(501L)
                .memberId(9L)
                .memberName("Nguyễn Anh Khoa")
                .rentalFee(new BigDecimal("60000"))
                .paymentMethod("CASH")
                .status("RETURNED")
                .returnedAt(reportDate.atTime(10, 15))
                .build();
        var vnpayLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(502L)
                .memberId(10L)
                .memberName("Hoàng Thị Ngọc")
                .rentalFee(new BigDecimal("40000"))
                .paymentMethod("VNPAY")
                .status("RETURNED")
                .returnedAt(reportDate.atTime(11, 0))
                .build();
        var freeLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(503L)
                .memberId(9L)
                .memberName("Nguyễn Anh Khoa")
                .rentalFee(BigDecimal.ZERO)
                .paymentMethod("CASH")
                .status("RETURNED")
                .returnedAt(reportDate.atTime(11, 30))
                .build();

        when(paymentRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end))
                .thenReturn(List.of(membershipPayment));
        when(paymentTransactionRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end))
                .thenReturn(List.of());
        when(equipmentLoanRepository.findByStatusIgnoreCaseAndReturnedAtGreaterThanEqualAndReturnedAtLessThanOrderByReturnedAtDesc(
                "RETURNED", start, end))
                .thenReturn(List.of(cashLoan, vnpayLoan, freeLoan));
        when(userRepository.findAllById(List.of(9L, 10L)))
                .thenReturn(List.of(User.builder().userId(9L).fullName("Nguyễn Anh Khoa").build()));

        var result = controller.getDailyReport(reportDate, receptionist);

        assertEquals(new BigDecimal("200000"), result.totalRevenue());
        assertEquals(3, result.completedPayments());
        assertEquals(3, result.payments().size());
        assertEquals("Hoàng Thị Ngọc", result.payments().get(0).memberName());
        assertEquals("equip-502", result.payments().get(0).paymentId());
        assertEquals(2, result.paymentMethods().size());
        assertEquals(new BigDecimal("40000"), result.paymentMethods().get(0).amount());
        assertEquals(1, result.paymentMethods().get(0).count());
        assertEquals(new BigDecimal("160000"), result.paymentMethods().get(1).amount());
        assertEquals(2, result.paymentMethods().get(1).count());
    }

    @Test
    void dashboardOverviewIncludesOverdueInActiveLoansAndEquipmentRevenue() {
        var equipmentLoanRepository = mock(com.sporthub.backend.repository.EquipmentLoanRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "equipmentLoanRepository", equipmentLoanRepository);

        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();

        var returnedLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(601L)
                .memberId(9L)
                .memberName("Nguyễn Anh Khoa")
                .rentalFee(new BigDecimal("90000"))
                .paymentMethod("VNPAY")
                .status("RETURNED")
                .returnedAt(today.atTime(10, 0))
                .build();
        var borrowedLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(602L)
                .status("BORROWED")
                .build();
        var overdueLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(603L)
                .status("OVERDUE")
                .build();

        when(paymentRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end))
                .thenReturn(List.of());
        when(paymentTransactionRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end))
                .thenReturn(List.of());
        when(equipmentLoanRepository.findByStatusIgnoreCaseAndReturnedAtGreaterThanEqualAndReturnedAtLessThanOrderByReturnedAtDesc(
                "RETURNED", start, end))
                .thenReturn(List.of(returnedLoan));
        when(equipmentLoanRepository.findByStatusIgnoreCaseOrderByLoanedAtDesc("BORROWED"))
                .thenReturn(List.of(borrowedLoan));
        when(equipmentLoanRepository.findByStatusIgnoreCaseOrderByLoanedAtDesc("OVERDUE"))
                .thenReturn(List.of(overdueLoan));
        when(userRepository.findAllById(any())).thenReturn(List.of());

        var overview = controller.getDashboardOverview(receptionist);

        assertEquals(new BigDecimal("90000"), overview.todayRevenue());
        assertEquals(1L, overview.completedTransactionsCount());
        assertEquals(2L, overview.activeLoansCount());
    }

    @Test
    void getMyProfileIncludesReturnedEquipmentLoansRecordedByStaff() {
        var equipmentLoanRepository = mock(com.sporthub.backend.repository.EquipmentLoanRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "equipmentLoanRepository", equipmentLoanRepository);

        User staff = User.builder()
                .userId(3L)
                .fullName("Phạm Minh Tú")
                .email("tu.receptionist@sporthub.vn")
                .phone("0912345678")
                .role("RECEPTIONIST")
                .status("ACTIVE")
                .build();
        lenient().when(userRepository.findById(3L)).thenReturn(java.util.Optional.of(staff));

        var myReturnedLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(701L)
                .rentalFee(new BigDecimal("60000"))
                .status("RETURNED")
                .recordedBy(3L)
                .build();
        var otherStaffLoan = com.sporthub.backend.entity.EquipmentLoan.builder()
                .loanId(702L)
                .rentalFee(new BigDecimal("40000"))
                .status("RETURNED")
                .recordedBy(4L)
                .build();
        when(equipmentLoanRepository.findByStatusIgnoreCaseOrderByLoanedAtDesc("RETURNED"))
                .thenReturn(List.of(myReturnedLoan, otherStaffLoan));

        var profile = controller.getMyProfile(receptionist);

        assertEquals(1L, profile.shiftStats().totalSalesHandled());
        assertEquals(new BigDecimal("60000"), profile.shiftStats().totalRevenueCollected());
    }
}
