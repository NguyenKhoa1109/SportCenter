import React, { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { apiRequest } from '../../services/apiClient';
import { StatCardSkeleton } from '../../components/common/Skeleton';
import { exportToCsv } from '../../utils/csvExporter';

const dateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfWeekString = (date) => {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateString(monday);
};

const formatPrice = (amount) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(amount || 0);

const formatTime = (value) => new Date(value).toLocaleTimeString('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
});

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(value);
  }
};

export default function AdminDashboardPage() {
  const todayStr = useMemo(() => dateString(new Date()), []);
  const [period, setPeriod] = useState('day'); // 'day' | 'month' | 'year' | 'all'
  const [reportDate, setReportDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);

  // Compute effective date query parameter based on period
  const queryParam = useMemo(() => {
    if (period === 'day') {
      return `period=day&date=${reportDate}`;
    }
    if (period === 'month') {
      return `period=month&date=${selectedMonth}-01`;
    }
    if (period === 'year') {
      return `period=year&date=${selectedYear}-01-01`;
    }
    return `period=all`;
  }, [period, reportDate, selectedMonth, selectedYear]);

  // Compute Human-readable period label
  const periodLabel = useMemo(() => {
    if (period === 'day') {
      const parts = reportDate.split('-');
      return `Ngày ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (period === 'month') {
      const parts = selectedMonth.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
    if (period === 'year') {
      return `Cả Năm ${selectedYear}`;
    }
    return 'Toàn Thời Gian (Lũy kế)';
  }, [period, reportDate, selectedMonth, selectedYear]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');

    const scheduleDate = period === 'day' ? reportDate : todayStr;
    const weekStart = startOfWeekString(new Date(`${scheduleDate}T12:00:00`));

    Promise.all([
      apiRequest(`/receptionist/report?${queryParam}`),
      apiRequest(`/bookings/receptionist-schedule?weekStart=${weekStart}`).catch(() => []),
    ])
      .then(([reportData, schedule]) => {
        if (!current) return;
        const filteredClasses = period === 'day'
          ? (Array.isArray(schedule) ? schedule.filter((item) => item.startTime?.slice(0, 10) === reportDate) : [])
          : (Array.isArray(schedule) ? schedule : []);

        setResponse({
          report: reportData,
          classes: filteredClasses,
        });
        setLoading(false);
      })
      .catch((requestError) => {
        if (!current) return;
        setError(requestError.message || 'Không thể tải báo cáo từ cơ sở dữ liệu.');
        setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [queryParam, period, reportDate, todayStr]);

  const report = response?.report || null;
  const classes = response?.classes || [];

  const bookedSeats = classes.reduce((total, item) => total + (item.bookedSlots || 0), 0);
  const availableSeats = classes.reduce((total, item) => total + (item.maxSlots || 0), 0);
  const fillPercent = availableSeats ? Math.round((bookedSeats / availableSeats) * 100) : 0;

  // Revenue Breakdown by Service Source
  const categoryBreakdown = useMemo(() => {
    if (!report?.payments?.length) return [];
    const map = {};
    for (const p of report.payments) {
      const type = p.type || 'Dịch vụ khác';
      let cat = 'Khác';
      const upper = type.toUpperCase();
      if (upper.includes('MEMBERSHIP') || upper.includes('GÓI') || upper.includes('PKG')) {
        cat = 'Gói tập Hội viên';
      } else if (upper.includes('COURT') || upper.includes('SÂN')) {
        cat = 'Đặt sân Thể thao';
      } else if (upper.includes('CLASS') || upper.includes('LỚP') || upper.includes('PT')) {
        cat = 'Lớp học & Huấn luyện viên';
      } else if (upper.includes('EQUIP') || upper.includes('DỤNG CỤ')) {
        cat = 'Thuê Dụng cụ';
      } else if (upper.includes('POS')) {
        cat = 'Bán hàng tại Quầy (POS)';
      }

      if (!map[cat]) {
        map[cat] = { category: cat, amount: 0, count: 0 };
      }
      map[cat].amount += Number(p.amount) || 0;
      map[cat].count += 1;
    }
    const total = Number(report.totalRevenue) || 1;
    return Object.values(map)
      .map((item) => ({
        ...item,
        percent: Math.min(100, Math.round((item.amount / total) * 100)),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [report]);

  const kpis = [
    { label: `Doanh thu (${periodLabel})`, value: formatPrice(report?.totalRevenue), icon: 'payments', desc: `${report?.completedPayments || 0} giao dịch hoàn tất` },
    { label: `Hội viên mới (${periodLabel})`, value: report?.newMembers ?? 0, icon: 'person_add', desc: 'Đăng ký tài khoản mới' },
    { label: period === 'day' ? 'Lớp trong ngày' : 'Lớp học theo dõi', value: classes.length, icon: 'stadium', desc: `${bookedSeats} học viên đã đặt` },
    { label: 'Tỷ lệ lấp đầy phòng học', value: `${fillPercent}%`, icon: 'pie_chart', desc: `${bookedSeats}/${availableSeats || 0} chỗ trống` },
  ];

  const handleExportCsv = () => {
    if (!report) return;
    const rows = [
      ['BÁO CÁO DOANH THU & HIỆU SUẤT TRUNG TÂM F SPORT'],
      ['Kỳ kiểm kê báo cáo', periodLabel],
      ['Thời gian xuất', new Date().toLocaleString('vi-VN')],
      ['Tổng doanh thu đã thu (VNĐ)', report.totalRevenue || 0],
      ['Số giao dịch hoàn tất', report.completedPayments || 0],
      ['Hội viên đăng ký mới', report.newMembers || 0],
      ['Tỷ lệ lấp đầy phòng học', `${fillPercent}%`],
      [],
      ['KIỂM KÊ DOANH THU THEO NGUỒN'],
      ['Nguồn thu', 'Số tiền (VNĐ)', 'Số giao dịch', 'Tỷ trọng (%)'],
      ...categoryBreakdown.map((c) => [c.category, c.amount, c.count, `${c.percent}%`]),
      [],
      ['DOANH THU THEO PHƯƠNG THỨC THANH TOÁN'],
      ['Phương thức', 'Số tiền (VNĐ)', 'Số giao dịch'],
      ...(report.paymentMethods || []).map((m) => [m.method, m.amount, m.count]),
      [],
      ['DANH SÁCH CHI TIẾT GIAO DỊCH'],
      ['Mã GD', 'Hội viên', 'Số điện thoại', 'Loại dịch vụ', 'Diễn giải', 'Phương thức', 'Trạng thái', 'Số tiền (VNĐ)', 'Thời gian'],
      ...(report.payments || []).map((p) => [
        p.paymentId,
        p.memberName || 'Khách vãng lai',
        p.phone || '',
        p.type || 'Dịch vụ',
        p.description || '',
        p.method,
        p.status,
        p.amount,
        formatDateTime(p.createdAt),
      ]),
    ];
    exportToCsv(`BaoCao_DoanhThu_${period}_${Date.now()}.csv`, rows);
  };

  return (
    <AdminLayout>
      <main className="space-y-6">
        {/* Header & Controls */}
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              F SPORT ADMIN · ĐIỀU HÀNH & KIỂM KÊ DOANH THU
            </div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl flex items-center gap-3">
              Tổng quan Doanh thu
              <span className="text-sm font-semibold px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                {periodLabel}
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Kiểm kê doanh thu chi tiết theo ngày, tháng, năm, phân loại nguồn thu và tra cứu từng giao dịch.
            </p>
          </div>

          {/* Action buttons & Period Selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
            {/* View Mode Tabs */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => setPeriod('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  period === 'day'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>Theo Ngày</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  period === 'month'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                <span>Theo Tháng</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod('year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  period === 'year'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">date_range</span>
                <span>Theo Năm</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  period === 'all'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">all_inclusive</span>
                <span>Toàn bộ</span>
              </button>
            </div>

            {/* Date/Month/Year Pickers */}
            {period === 'day' && (
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="material-symbols-outlined text-orange-500 text-[18px]">event</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-sm text-slate-800 font-bold outline-none cursor-pointer"
                />
              </label>
            )}

            {period === 'month' && (
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="material-symbols-outlined text-orange-500 text-[18px]">calendar_month</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-sm text-slate-800 font-bold outline-none cursor-pointer"
                />
              </label>
            )}

            {period === 'year' && (
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="material-symbols-outlined text-orange-500 text-[18px]">date_range</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-sm text-slate-800 font-bold outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!report || loading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Xuất Báo Cáo (CSV)</span>
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}

        {loading ? (
          <StatCardSkeleton count={4} />
        ) : (
          <>
            {/* KPI Cards */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi, idx) => {
                const colorConfig = [
                  { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
                  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
                  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
                  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
                ][idx % 4];

                return (
                  <article key={kpi.label} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm card-hover">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{kpi.label}</span>
                      <div className={`w-9 h-9 rounded-xl ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border} border flex items-center justify-center shrink-0`}>
                        <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                      </div>
                    </div>
                    <strong className="text-2xl font-black text-slate-900 tracking-tight block">{kpi.value}</strong>
                    <span className="text-xs text-slate-500 font-medium mt-1 block">{kpi.desc}</span>
                  </article>
                );
              })}
            </section>

            {/* Breakdown & Schedules */}
            <section className="grid gap-6 lg:grid-cols-5">
              {/* Revenue Breakdown by Source & Method */}
              <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500 text-[20px]">account_balance_wallet</span>
                      Kiểm Kê Nguồn Thu
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {periodLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Phân tích doanh thu theo danh mục dịch vụ tại trung tâm.
                  </p>

                  {categoryBreakdown.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {categoryBreakdown.map((item) => (
                        <div key={item.category} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-800">{item.category} ({item.count} GD)</span>
                            <span className="font-bold text-slate-900">{formatPrice(item.amount)} ({item.percent}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">Chưa có giao dịch phát sinh trong kỳ này.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Theo phương thức thanh toán
                  </h3>
                  {report?.paymentMethods?.length ? (
                    <ul className="space-y-2">
                      {report.paymentMethods.map((method) => (
                        <li key={method.method} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {method.method}
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatPrice(method.amount)} · <span className="font-normal text-slate-500">{method.count} GD</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Chưa có dữ liệu.</p>
                  )}
                </div>
              </article>

              {/* Class Schedule in period */}
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
                <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold uppercase text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-500 text-[20px]">event_note</span>
                      {period === 'day' ? 'Lịch lớp trong ngày' : 'Lịch ca học theo dõi'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">Sĩ số học viên cập nhật theo thời gian thực.</p>
                  </div>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {classes.length} Lớp học
                  </span>
                </div>
                {classes.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">Không có lớp học nào trong kỳ này.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase text-slate-500 sticky top-0">
                        <tr>
                          <th className="px-4 py-3">Lớp học & Bộ môn</th>
                          <th className="px-4 py-3">Thời gian</th>
                          <th className="px-4 py-3">Huấn luyện viên</th>
                          <th className="px-4 py-3 text-right">Sĩ số</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classes.map((item) => (
                          <tr key={item.sessionId} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3">
                              <strong className="text-slate-900 block">{item.className}</strong>
                              <span className="text-slate-500 text-[11px]">{item.sportName || 'Thể thao đa năng'}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600 font-mono text-[11px]">
                              {formatTime(item.startTime)}–{formatTime(item.endTime)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{item.coachName || 'Chưa gán'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                item.bookedSlots >= item.maxSlots
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {item.bookedSlots} / {item.maxSlots}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </section>

            {/* Detailed Transactions List */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="font-bold uppercase text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]">receipt_long</span>
                    Chi Tiết Giao Dịch ({periodLabel})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Bấm vào bất kỳ dòng nào hoặc nút con mắt để xem đầy đủ thông tin kiểm kê giao dịch.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  Tổng: <span className="font-black text-slate-900">{report?.payments?.length || 0}</span> giao dịch
                </div>
              </div>

              {report?.payments?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 uppercase text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Mã GD</th>
                        <th className="px-4 py-3">Hội viên / Người trả</th>
                        <th className="px-4 py-3">Loại dịch vụ</th>
                        <th className="px-4 py-3">Phương thức</th>
                        <th className="px-4 py-3">Thời gian</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Số tiền</th>
                        <th className="px-4 py-3 text-center">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.payments.map((payment) => (
                        <tr
                          key={payment.paymentId}
                          onClick={() => setSelectedTx(payment)}
                          className="hover:bg-orange-50/60 transition cursor-pointer group"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-orange-600">
                            {payment.paymentId}
                          </td>
                          <td className="px-4 py-3">
                            <strong className="text-slate-900 block">{payment.memberName || 'Khách vãng lai'}</strong>
                            {payment.phone && (
                              <span className="text-[11px] text-slate-500 font-mono">{payment.phone}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {payment.type || 'Dịch vụ'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {payment.method}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {formatDateTime(payment.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                            {formatPrice(payment.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTx(payment);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-orange-500 group-hover:text-white text-slate-600 transition shadow-2xs"
                              title="Xem chi tiết giao dịch"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">receipt</span>
                  Chưa có giao dịch phát sinh trong kỳ kiểm kê này.
                </div>
              )}
            </section>
          </>
        )}

        {/* Modal Chi Tiết Giao Dịch */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Chi Tiết Giao Dịch</h3>
                    <p className="text-white/80 text-xs font-mono">{selectedTx.paymentId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="w-8 h-8 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition cursor-pointer text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5">
                {/* Amount Highlight Card */}
                <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-700">Số tiền thanh toán</span>
                    <strong className="text-2xl font-black text-slate-900 block mt-0.5">
                      {formatPrice(selectedTx.amount)}
                    </strong>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {selectedTx.status || 'Hoàn tất'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="space-y-3 text-sm divide-y divide-slate-100">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-medium">Khách hàng / Hội viên:</span>
                    <strong className="text-slate-900 font-bold">{selectedTx.memberName || 'Khách vãng lai'}</strong>
                  </div>

                  {selectedTx.phone && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500 font-medium">Số điện thoại:</span>
                      <span className="text-slate-800 font-mono font-semibold">{selectedTx.phone}</span>
                    </div>
                  )}

                  {selectedTx.email && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500 font-medium">Email liên hệ:</span>
                      <span className="text-slate-800 font-medium">{selectedTx.email}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-medium">Loại dịch vụ:</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-xs">
                      {selectedTx.type || 'Dịch vụ'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-medium">Diễn giải dịch vụ:</span>
                    <span className="text-slate-800 font-medium text-right max-w-[260px]">
                      {selectedTx.description || selectedTx.type || 'Thanh toán dịch vụ'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-medium">Phương thức thanh toán:</span>
                    <span className="text-slate-900 font-bold">{selectedTx.method}</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 font-medium">Thời gian giao dịch:</span>
                    <span className="text-slate-800 font-mono text-xs">{formatDateTime(selectedTx.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>In hóa đơn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
