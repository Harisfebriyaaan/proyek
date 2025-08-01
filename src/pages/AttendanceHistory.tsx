import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Filter, Download, CheckCircle, XCircle, AlertTriangle, Users, RefreshCw, MapPin } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Swal from 'sweetalert2';

// Define TypeScript interfaces for type safety
interface Profile {
  id: string;
  name: string;
  email: string;
  employee_id: string | null;
  department: string | null;
  role?: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  timestamp: string;
  type: 'masuk' | 'keluar' | 'tidak_hadir';
  status: 'berhasil' | 'wajah_tidak_valid' | 'lokasi_tidak_valid' | 'tidak_hadir';
  is_late: boolean;
  late_minutes: number | null;
  work_hours: number | null;
  overtime_hours: number | null;
  latitude: number | null;
  longitude: number | null;
  profiles?: Profile;
}

interface Filters {
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  employeeId: string;
}

const AttendanceHistory: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [filters, setFilters] = useState<Filters>({
    startDate: '',
    endDate: '',
    type: '',
    status: '',
    employeeId: '',
  });

  // Check user authentication and role
  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setUserRole(profile.role);

      if (profile.role === 'admin') {
        await Promise.all([fetchEmployees(), fetchAllAttendance()]);
      } else {
        await fetchAttendanceHistory(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat',
        text: 'Terjadi kesalahan saat memuat data pengguna.',
      });
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all employees for admin
  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, employee_id, department')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat',
        text: 'Terjadi kesalahan saat memuat data karyawan.',
      });
    }
  };

  // Fetch all attendance records for admin
  const fetchAllAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id(id, name, email, employee_id, department)
        `)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (error) {
      console.error('Error fetching all attendance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat',
        text: 'Terjadi kesalahan saat memuat data absensi.',
      });
    }
  };

  // Fetch attendance history for a specific user
  const fetchAttendanceHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat',
        text: 'Terjadi kesalahan saat memuat riwayat absensi.',
      });
    }
  };

  // Apply filters to attendance data
  const applyFilters = useCallback(() => {
    let filtered = [...attendanceData];

    filtered = filtered.filter(record => 
      record.type === 'masuk' || record.type === 'keluar'
    );

    if (userRole === 'admin' && selectedEmployee !== 'all') {
      filtered = filtered.filter(record => record.user_id === selectedEmployee);
    }

    if (filters.startDate) {
      filtered = filtered.filter(record => 
        new Date(record.timestamp) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(record => 
        new Date(record.timestamp) <= endDate
      );
    }

    if (filters.type) {
      filtered = filtered.filter(record => record.type === filters.type);
    }

    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    setFilteredData(filtered);
  }, [attendanceData, filters, selectedEmployee, userRole]);

  // Handle filter input changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  // Handle employee selection
  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEmployee(e.target.value);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: '',
      status: '',
      employeeId: '',
    });
    setSelectedEmployee('all');
  };

  // Refresh data
  const refreshData = async () => {
    setLoading(true);
    try {
      if (userRole === 'admin') {
        await fetchAllAttendance();
      } else {
        await fetchAttendanceHistory(user.id);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Refresh',
        text: 'Terjadi kesalahan saat memperbarui data.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Export data to CSV
  const exportToCsv = async () => {
    if (filteredData.length === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'Tidak Ada Data',
        text: 'Tidak ada data absensi untuk diexport.',
      });
      return;
    }

    try {
      const headers = userRole === 'admin'
        ? ['Tanggal', 'Waktu', 'Karyawan', 'Departemen', 'Jenis', 'Status', 'Terlambat', 'Menit Terlambat', 'Jam Kerja', 'Lembur', 'Latitude', 'Longitude']
        : ['Tanggal', 'Waktu', 'Jenis', 'Status', 'Terlambat', 'Menit Terlambat', 'Jam Kerja', 'Lembur', 'Latitude', 'Longitude'];

      const csvContent = [
        headers,
        ...filteredData.map(record => {
          const date = new Date(record.timestamp);
          const dateStr = date.toLocaleDateString('id-ID');
          const timeStr = date.toLocaleTimeString('id-ID');
          return userRole === 'admin'
            ? [
                dateStr,
                timeStr,
                record.profiles?.name || 'Unknown',
                record.profiles?.department || '-',
                record.type === 'masuk' ? 'Masuk' : record.type === 'keluar' ? 'Keluar' : 'Tidak Hadir',
                record.status,
                record.is_late ? 'Ya' : 'Tidak',
                record.late_minutes ?? '0',
                record.work_hours ?? '0',
                record.overtime_hours ?? '0',
                record.latitude ?? '',
                record.longitude ?? '',
              ]
            : [
                dateStr,
                timeStr,
                record.type === 'masuk' ? 'Masuk' : record.type === 'keluar' ? 'Keluar' : 'Tidak Hadir',
                record.status,
                record.is_late ? 'Ya' : 'Tidak',
                record.late_minutes ?? '0',
                record.work_hours ?? '0',
                record.overtime_hours ?? '0',
                record.latitude ?? '',
                record.longitude ?? '',
              ];
        }),
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await Swal.fire({
        icon: 'success',
        title: 'Export Berhasil',
        text: 'Data absensi berhasil diexport ke CSV.',
      });
    } catch (err) {
      console.error('Error exporting to CSV:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Export Gagal',
        text: 'Terjadi kesalahan saat export data absensi.',
      });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'berhasil':
        return 'text-green-600 bg-green-100';
      case 'wajah_tidak_valid':
        return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid':
        return 'text-yellow-600 bg-yellow-100';
      case 'tidak_hadir':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'berhasil':
        return <CheckCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
      case 'tidak_hadir':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'berhasil':
        return 'Berhasil';
      case 'wajah_tidak_valid':
        return 'Wajah Invalid';
      case 'lokasi_tidak_valid':
        return 'Lokasi Invalid';
      case 'tidak_hadir':
        return 'Tidak Hadir';
      default:
        return 'Gagal';
    }
  };

  // Format date and time
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  // Run checkUser on component mount
  useEffect(() => {
    checkUser();
  }, []);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat data absensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Laporan Absensi</h1>
                <p className="text-sm text-blue-100">
                  {userRole === 'admin'
                    ? 'Lihat dan export laporan absensi semua karyawan'
                    : 'Lihat dan export riwayat absensi Anda'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={refreshData}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={exportToCsv}
                disabled={filteredData.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Filter Laporan</h2>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {/* Mobile: Compact 2-column grid */}
            <div className="grid grid-cols-2 gap-3 sm:hidden">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Jenis</label>
                <select
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Semua</option>
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Semua</option>
                  <option value="berhasil">Berhasil</option>
                  <option value="wajah_tidak_valid">Wajah Invalid</option>
                  <option value="lokasi_tidak_valid">Lokasi Invalid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dari</label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sampai</label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Desktop: Show all filters */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {userRole === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Karyawan</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      value={selectedEmployee}
                      onChange={handleEmployeeChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Semua Karyawan</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} {employee.employee_id ? `(${employee.employee_id})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Akhir</label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Absensi</label>
                <select
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Semua Jenis</option>
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Semua Status</option>
                  <option value="berhasil">Berhasil</option>
                  <option value="wajah_tidak_valid">Wajah Invalid</option>
                  <option value="lokasi_tidak_valid">Lokasi Invalid</option>
                </select>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 flex justify-between items-center">
              <div className="text-xs sm:text-sm text-gray-500">
                Menampilkan {filteredData.length} dari {attendanceData.length} data
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  Data Absensi ({filteredData.length})
                </h2>
              </div>
              {userRole === 'admin' && (
                <div className="text-sm text-gray-500">
                  {selectedEmployee === 'all' ? 'Menampilkan semua karyawan' : `Menampilkan ${employees.find(e => e.id === selectedEmployee)?.name || 'karyawan'}`}
                </div>
              )}
            </div>
          </div>

          {filteredData.length > 0 ? (
            <>
              {/* Mobile: Card Layout */}
              <div className="sm:hidden space-y-3 p-4">
                {filteredData.map((record) => {
                  const dateTime = formatDateTime(record.timestamp);
                  return (
                    <div key={record.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            record.type === 'masuk' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {record.type === 'masuk' ? 'Masuk' : 'Keluar'}
                          </span>
                          <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                            {getStatusIcon(record.status)}
                            <span>{getStatusText(record.status)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {dateTime.time}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {dateTime.date}
                      </div>
                      {userRole === 'admin' && (
                        <div className="text-xs text-gray-600 mb-1">
                          {record.profiles?.name || 'Unknown'} • {record.profiles?.department || '-'}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {record.is_late ? (
                            <span className="text-red-600">Terlambat {record.late_minutes} menit</span>
                          ) : (
                            <span className="text-green-600">Tepat Waktu</span>
                          )}
                        </span>
                        <span>
                          {record.work_hours && record.work_hours > 0 ? `${record.work_hours} jam` : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tanggal & Waktu
                      </th>
                      {userRole === 'admin' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Karyawan
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jenis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Keterlambatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jam Kerja
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lokasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((record) => {
                      const dateTime = formatDateTime(record.timestamp);
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-blue-50 cursor-pointer transition"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {dateTime.date}
                              </div>
                              <div className="text-sm text-gray-500">
                                {dateTime.time}
                              </div>
                            </div>
                          </td>
                          {userRole === 'admin' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {record.profiles?.name || 'Unknown'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {record.profiles?.department || '-'}
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {record.type === 'masuk' ? 'Masuk' : 'Keluar'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              <span>{getStatusText(record.status)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.is_late ? (
                              <div className="text-sm text-red-600">
                                <span className="font-medium">{record.late_minutes} menit</span>
                              </div>
                            ) : (
                              <div className="text-sm text-green-600">
                                <span className="font-medium">Tepat Waktu</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {record.work_hours && record.work_hours > 0 ? (
                                <span>{record.work_hours} jam</span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                            {record.overtime_hours && record.overtime_hours > 0 && (
                              <div className="text-xs text-blue-600">
                                Lembur: {record.overtime_hours} jam
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.latitude && record.longitude ? (
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                                <span>
                                  {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">Tidak ada lokasi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-2">Tidak ada data absensi ditemukan</p>
              <p className="text-gray-400">Coba sesuaikan filter atau periksa kembali nanti</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail Absensi */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 relative animate-fade-in">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              title="Tutup"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Detail Absensi</h3>
            <div className="mb-4 text-sm text-gray-500">
              {formatDateTime(selectedRecord.timestamp).date} • {formatDateTime(selectedRecord.timestamp).time}
            </div>
            <div className="space-y-2">
              {userRole === 'admin' && (
                <div>
                  <span className="font-medium text-gray-700">Karyawan:</span> {selectedRecord.profiles?.name || 'Unknown'}
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">Jenis:</span> {selectedRecord.type === 'masuk' ? 'Masuk' : 'Keluar'}
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${getStatusColor(selectedRecord.status)}`}>
                  {getStatusIcon(selectedRecord.status)}
                  <span className="ml-1">{getStatusText(selectedRecord.status)}</span>
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Keterlambatan:</span> {selectedRecord.is_late ? `${selectedRecord.late_minutes} menit` : 'Tepat Waktu'}
              </div>
              <div>
                <span className="font-medium text-gray-700">Jam Kerja:</span> {selectedRecord.work_hours && selectedRecord.work_hours > 0 ? `${selectedRecord.work_hours} jam` : '-'}
              </div>
              {selectedRecord.overtime_hours && selectedRecord.overtime_hours > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Lembur:</span> {selectedRecord.overtime_hours} jam
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">Lokasi:</span> {selectedRecord.latitude && selectedRecord.longitude ? `${selectedRecord.latitude.toFixed(4)}, ${selectedRecord.longitude.toFixed(4)}` : 'Tidak ada lokasi'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;