import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading    = true;
  bool _unreadOnly = false;
  int  _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.getNotifications(read: _unreadOnly ? false : null);
      final count = await ApiService.getUnreadNotificationCount();
      if (!mounted) return;
      setState(() {
        _notifications = List<Map<String, dynamic>>.from(
          (data['notifications'] as List<dynamic>? ?? []).map((e) => Map<String, dynamic>.from(e as Map)),
        );
        _unreadCount = count;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _markRead(String id) async {
    try {
      await ApiService.markNotificationAsRead(id);
      setState(() {
        _notifications = _notifications.map((n) {
          if (n['_id'] == id) return {...n, 'read': true};
          return n;
        }).toList();
        if (_unreadCount > 0) _unreadCount--;
      });
    } catch (_) {}
  }

  Future<void> _markAll() async {
    try {
      await ApiService.markAllNotificationsAsRead();
      setState(() {
        _notifications = _notifications.map((n) => {...n, 'read': true}).toList();
        _unreadCount = 0;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Toutes les notifications ont été lues'), behavior: SnackBarBehavior.floating),
        );
      }
    } catch (_) {}
  }

  IconData _iconForType(String? type) {
    switch (type) {
      case 'TRANSPORT_CREATED':
      case 'TRANSPORT_ASSIGNED':   return Icons.directions_car_outlined;
      case 'TRANSPORT_COMPLETED':  return Icons.check_circle_outline;
      case 'TRANSPORT_CANCELLED':  return Icons.cancel_outlined;
      case 'DRIVER_ASSIGNED':      return Icons.person_pin_outlined;
      case 'DRIVER_ACCEPTED':      return Icons.thumb_up_outlined;
      case 'DELAY_ALERT':          return Icons.warning_amber_outlined;
      case 'NO_SHOW':              return Icons.person_off_outlined;
      case 'INVOICE_READY':        return Icons.receipt_long_outlined;
      case 'PAYMENT_SUCCEEDED':    return Icons.payments_outlined;
      case 'PAYMENT_FAILED':       return Icons.money_off_outlined;
      default:                     return Icons.notifications_outlined;
    }
  }

  Color _colorForType(String? type) {
    switch (type) {
      case 'DELAY_ALERT':
      case 'NO_SHOW':
      case 'PAYMENT_FAILED':       return Colors.red.shade600;
      case 'TRANSPORT_COMPLETED':
      case 'PAYMENT_SUCCEEDED':    return Colors.green.shade600;
      case 'INVOICE_READY':        return Colors.orange.shade600;
      default:                     return AppTheme.primary;
    }
  }

  String _timeAgo(String? dateStr) {
    if (dateStr == null) return '';
    final date = DateTime.tryParse(dateStr);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inSeconds < 60)  return 'À l\'instant';
    if (diff.inMinutes < 60)  return 'Il y a ${diff.inMinutes} min';
    if (diff.inHours < 24)    return 'Il y a ${diff.inHours} h';
    return 'Il y a ${diff.inDays} j';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: AppTheme.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            const Text('Notifications',
                style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 17)),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10)),
                child: Text('$_unreadCount', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ],
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAll,
              child: const Text('Tout lire', style: TextStyle(color: AppTheme.primary, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Filtre non lues
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _filterChip('Toutes',   !_unreadOnly, () { setState(() => _unreadOnly = false); _load(); }),
                const SizedBox(width: 8),
                _filterChip('Non lues', _unreadOnly,  () { setState(() => _unreadOnly = true);  _load(); }),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF0F0F0)),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                : _notifications.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.notifications_none_outlined, size: 56, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            Text('Aucune notification', style: TextStyle(fontSize: 15, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                            const SizedBox(height: 4),
                            Text('Revenez plus tard', style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppTheme.primary,
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: _notifications.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 4),
                          itemBuilder: (ctx, i) => _buildItem(_notifications[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppTheme.primary : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppTheme.secondary)),
      ),
    );
  }

  Widget _buildItem(Map<String, dynamic> notif) {
    final bool isRead  = notif['read'] as bool? ?? true;
    final String? type = notif['type'] as String?;
    final color        = _colorForType(type);

    return GestureDetector(
      onTap: () {
        if (!isRead) _markRead(notif['_id'] as String? ?? '');
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: isRead ? Colors.white : const Color(0xFFF0F5FF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isRead ? const Color(0xFFF0F0F0) : AppTheme.primary.withOpacity(0.25)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
                child: Icon(_iconForType(type), size: 20, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(notif['title'] as String? ?? '',
                        style: TextStyle(fontSize: 13, fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                            color: AppTheme.onSurface)),
                    if ((notif['message'] as String?)?.isNotEmpty ?? false) ...[
                      const SizedBox(height: 3),
                      Text(notif['message'] as String,
                          style: const TextStyle(fontSize: 12, color: AppTheme.secondary, height: 1.3),
                          maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                    const SizedBox(height: 6),
                    Text(_timeAgo(notif['createdAt'] as String?),
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                  ],
                ),
              ),
              if (!isRead)
                Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 4),
                    decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle)),
            ],
          ),
        ),
      ),
    );
  }
}
