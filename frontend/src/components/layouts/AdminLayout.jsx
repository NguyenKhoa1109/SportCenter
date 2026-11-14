import React from 'react';
import PortalLayout from './PortalLayout';
import { useApp } from '../../context/AppContext';

export default function AdminLayout({ children }) {
  const { currentUser, showToast } = useApp();
  const adminMenu = [
    {
      label: 'Tổng quan',
      path: '/admin',
      icon: 'grid_view',
      section: 'Vận hành & Cơ sở',
      mobilePin: true,
      mobileLabel: 'Tổng quan',
      subtitle: 'Doanh thu, tỉ lệ lấp đầy sân, báo cáo vận hành',
    },
    {
      label: 'Lịch & Sân bãi',
      path: '/admin/facilities',
      icon: 'stadium',
      section: 'Vận hành & Cơ sở',
      mobilePin: true,
      mobileLabel: 'Sân bãi',
      subtitle: 'Lịch đặt cụm sân Pickleball, Tennis, Bể bơi',
    },
    {
      label: 'Bảo trì sân bãi',
      path: '/admin/maintenance',
      icon: 'build',
      section: 'Vận hành & Cơ sở',
      subtitle: 'Quản lý lịch bảo trì sân bãi và thiết bị',
    },
    {
      label: 'Gói tập & Dịch vụ',
      path: '/admin/packages',
      icon: 'card_membership',
      section: 'Vận hành & Cơ sở',
      subtitle: 'Cấu hình giá thẻ, thời hạn, quyền lợi',
    },
    {
      label: 'Duyệt & Phê duyệt',
      path: '/admin/staff-approvals',
      icon: 'how_to_reg',
      section: 'Nhân sự & Hội viên',
      mobilePin: true,
      mobileLabel: 'Phê duyệt',
      subtitle: 'Duyệt hoặc từ chối đăng ký Coach và Lễ tân',
    },
    {
      label: 'Quản lý Hội viên',
      path: '/admin/members',
      icon: 'shield_person',
      section: 'Nhân sự & Hội viên',
      mobilePin: true,
      mobileLabel: 'Hội viên',
      subtitle: 'Danh sách, trạng thái thẻ và hồ sơ hội viên',
    },
    {
      label: 'Nhân sự & Khách',
      path: '/admin/staff',
      icon: 'group',
      section: 'Nhân sự & Hội viên',
      subtitle: 'Danh sách HLV, lễ tân, tài khoản người dùng',
    },
    {
      label: 'Đối soát thanh toán dư',
      path: '/admin/payment-reconciliation',
      icon: 'payments',
      section: 'Tài chính & Hệ thống',
      subtitle: 'Đối soát giao dịch dư và hoàn tiền thanh toán',
    },
    {
      label: 'Thông báo hàng loạt',
      path: '/admin/broadcast',
      icon: 'campaign',
      section: 'Tài chính & Hệ thống',
      subtitle: 'Gửi thông báo tới hội viên và nhân viên',
    },
    {
      label: 'Nhật ký hệ thống',
      path: '/admin/audit-logs',
      icon: 'history',
      section: 'Tài chính & Hệ thống',
      subtitle: 'Truy vết thao tác và nhật ký kiểm toán',
    },
    {
      label: 'Cài đặt & Phân quyền',
      path: '/admin/settings',
      icon: 'settings',
      section: 'Tài chính & Hệ thống',
      subtitle: 'Chính sách hệ thống, ma trận quyền và cấu hình AI',
    },
  ];

  return (
    <PortalLayout
      role="admin"
      roleBadge="F SPORT ADMIN"
      currentUser={currentUser}
      menuItems={adminMenu}
      quickAction={{
        label: 'Xuất Báo Cáo',
        icon: 'download',
        onClick: () => {
          showToast('Xuất báo cáo', 'Đang kết xuất và tải xuống bản báo cáo vận hành trung tâm...', 'success');
          const csvContent = "\uFEFF" + 
            "BÁO CÁO VẬN HÀNH & DOANH THU TRUNG TÂM THỂ THAO SPORT HUB\n" +
            "Ngày xuất," + new Date().toLocaleDateString('vi-VN') + "\n\n" +
            "CHỈ SỐ TỔNG QUAN,GIÁ TRỊ\n" +
            "Tổng doanh thu tháng,158.450.000 VNĐ\n" +
            "Hội viên mới,42 hội viên\n" +
            "Tổng lượt check-in qua cổng,586 lượt\n" +
            "Tỷ lệ lấp đầy sân & lớp,88.5%\n\n" +
            "DOANH THU THEO PHƯƠNG THỨC THANH TOÁN,SỐ TIỀN,SỐ LƯỢNG GIAO DỊCH\n" +
            "Thanh toán trực tuyến VNPay,94.200.000 VNĐ,142\n" +
            "Tiền mặt tại quầy POS,38.150.000 VNĐ,58\n" +
            "Thẻ ngân hàng / POS,26.100.000 VNĐ,35\n";
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `BaoCao_VanHanh_SportHub_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        },
      }}
    >
      {children}
    </PortalLayout>
  );
}
