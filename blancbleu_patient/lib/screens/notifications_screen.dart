import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _transport   = true;
  bool _factures    = true;
  bool _ordonnances = true;
  bool _rappels     = false;
  bool _loading     = true;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final p = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _transport   = p.getBool('notif_transport')   ?? true;
      _factures    = p.getBool('notif_factures')    ?? true;
      _ordonnances = p.getBool('notif_ordonnances') ?? true;
      _rappels     = p.getBool('notif_rappels')     ?? false;
      _loading     = false;
    });
  }

  Future<void> _set(String key, bool val) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(key, val);
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
        title: const Text(
          'Notifications',
          style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _section('ACTIVITÉ', Icons.notifications_active_outlined, [
                  _toggle(
                    icon: Icons.directions_car_outlined,
                    iconBg: const Color(0xFFEFF6FF),
                    iconColor: AppTheme.primary,
                    title: 'Transports',
                    subtitle: 'Mises à jour en temps réel de vos transports',
                    value: _transport,
                    onChanged: (v) {
                      setState(() => _transport = v);
                      _set('notif_transport', v);
                    },
                  ),
                  _divider(),
                  _toggle(
                    icon: Icons.receipt_long_outlined,
                    iconBg: const Color(0xFFF0FDF4),
                    iconColor: Colors.green.shade700,
                    title: 'Factures',
                    subtitle: 'Nouvelles factures et confirmations de paiement',
                    value: _factures,
                    onChanged: (v) {
                      setState(() => _factures = v);
                      _set('notif_factures', v);
                    },
                  ),
                  _divider(),
                  _toggle(
                    icon: Icons.description_outlined,
                    iconBg: const Color(0xFFFFF7ED),
                    iconColor: Colors.orange.shade700,
                    title: 'Ordonnances',
                    subtitle: 'Validation et mises à jour de vos ordonnances',
                    value: _ordonnances,
                    onChanged: (v) {
                      setState(() => _ordonnances = v);
                      _set('notif_ordonnances', v);
                    },
                  ),
                ]),
                const SizedBox(height: 16),
                _section('RAPPELS', Icons.alarm_outlined, [
                  _toggle(
                    icon: Icons.event_outlined,
                    iconBg: const Color(0xFFFDF2F8),
                    iconColor: Colors.purple.shade600,
                    title: 'Rappels de transport',
                    subtitle: 'Rappel 1h avant le départ prévu',
                    value: _rappels,
                    onChanged: (v) {
                      setState(() => _rappels = v);
                      _set('notif_rappels', v);
                    },
                  ),
                ]),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, size: 16, color: AppTheme.primary),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Les notifications sont envoyées uniquement lors des mises à jour importantes.',
                          style: TextStyle(fontSize: 12, color: AppTheme.primary, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _section(String title, IconData icon, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Row(
              children: [
                Icon(icon, size: 16, color: AppTheme.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                        color: AppTheme.secondary, letterSpacing: 1.2)),
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }

  Widget _toggle({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(fontSize: 12, color: AppTheme.secondary, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppTheme.primary,
          ),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(height: 1, indent: 70, color: Color(0xFFF3F4F6));
}
