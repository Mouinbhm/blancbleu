import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  static const _navItems = [
    _NavItem(icon: Icons.home_outlined,      filledIcon: Icons.home,           label: 'Accueil'),
    _NavItem(icon: Icons.medical_services_outlined, filledIcon: Icons.medical_services, label: 'Transports'),
    _NavItem(icon: Icons.receipt_long_outlined, filledIcon: Icons.receipt_long,  label: 'Factures'),
    _NavItem(icon: Icons.person_outline,     filledIcon: Icons.person,          label: 'Profil'),
  ];

  // ── AppBar ─────────────────────────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 1,
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            // Avatar patient
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFDBEAFE),
                border: Border.all(color: AppTheme.primaryContainer, width: 2),
              ),
              child: const Center(
                child: Text(
                  'M',
                  style: TextStyle(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.bold,
                    fontSize: 17,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'BlancBleu',
              style: TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w900,
                fontSize: 19,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
      actions: [
        IconButton(
          onPressed: () {},
          icon: const Icon(Icons.notifications_outlined, color: Colors.grey),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  // ── Bottom Nav ─────────────────────────────────────────────────────────────
  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(_navItems.length, (i) {
              final item = _navItems[i];
              final active = _selectedIndex == i;
              return GestureDetector(
                onTap: () {
                  if (i == 3) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ProfileScreen()),
                    );
                  } else {
                    setState(() => _selectedIndex = i);
                  }
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFFEFF6FF) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        active ? item.filledIcon : item.icon,
                        color: active ? AppTheme.primary : Colors.grey,
                        size: 24,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: active ? AppTheme.primary : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  Widget _buildBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildWelcome(),
          const SizedBox(height: 28),
          _buildNextTransportCard(),
          const SizedBox(height: 24),
          _buildQuickActions(),
          const SizedBox(height: 24),
          _buildLastTransports(),
          const SizedBox(height: 24),
          _buildMapSection(),
        ],
      ),
    );
  }

  // ── Section 1 — Welcome ────────────────────────────────────────────────────
  Widget _buildWelcome() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: const [
        Text(
          'Bonjour Marcel 👋',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
            color: AppTheme.onSurface,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Mardi 29 Avril · Nice 22°C ☀️',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.secondary,
          ),
        ),
      ],
    );
  }

  // ── Section 2 — Prochain transport ─────────────────────────────────────────
  Widget _buildNextTransportCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'PROCHAIN TRANSPORT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primary,
                        letterSpacing: 1.2,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Demain 30 avril à 08h00',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurface,
                        letterSpacing: -0.3,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: const Text(
                    'Confirmé ✅',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Destination
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF2F3FE),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.medical_services, color: AppTheme.primary),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CHU de Nice · Dialyse',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.onSurface,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Route de Grenoble, Nice',
                          style: TextStyle(fontSize: 12, color: AppTheme.secondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Footer
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.directions_car_outlined, size: 18, color: AppTheme.secondary),
                    SizedBox(width: 6),
                    Text(
                      'Véhicule : TPMR-01',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppTheme.secondary),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Text('Suivre en direct', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  label: const Icon(Icons.arrow_forward, size: 16),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryContainer,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    shape: const StadiumBorder(),
                    elevation: 0,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Section 3 — Quick Actions ──────────────────────────────────────────────
  Widget _buildQuickActions() {
    final actions = [
      _QuickAction(
        icon: Icons.add_circle,
        label: 'Nouveau',
        bgColor: AppTheme.primary,
        iconColor: Colors.white,
        textColor: Colors.white,
        filled: true,
      ),
      _QuickAction(
        icon: Icons.calendar_month,
        label: 'Mes transports',
        bgColor: Colors.white,
        iconColor: AppTheme.primary,
        textColor: AppTheme.onSurface,
        filled: false,
      ),
      _QuickAction(
        icon: Icons.receipt_long,
        label: 'Factures',
        bgColor: Colors.white,
        iconColor: AppTheme.primary,
        textColor: AppTheme.onSurface,
        filled: false,
      ),
      _QuickAction(
        icon: Icons.person,
        label: 'Profil',
        bgColor: Colors.white,
        iconColor: AppTheme.primary,
        textColor: AppTheme.onSurface,
        filled: false,
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 14,
      mainAxisSpacing: 14,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.8,
      children: actions.map((a) {
        return GestureDetector(
          onTap: () {},
          child: AnimatedScale(
            scale: 1,
            duration: const Duration(milliseconds: 100),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: a.bgColor,
                borderRadius: BorderRadius.circular(14),
                border: a.filled ? null : Border.all(color: Colors.grey.shade100),
                boxShadow: [
                  BoxShadow(
                    color: a.filled
                        ? AppTheme.primary.withOpacity(0.2)
                        : Colors.black.withOpacity(0.04),
                    blurRadius: a.filled ? 10 : 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(a.icon, color: a.iconColor, size: 26),
                  const SizedBox(height: 6),
                  Text(
                    a.label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: a.textColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Section 4 — Derniers transports ───────────────────────────────────────
  Widget _buildLastTransports() {
    final trips = [
      _TripItem(
        destination: 'Cabinet Cardiologie',
        date: '25 Avril · 14h30',
        status: 'Terminé',
        statusColor: Colors.green.shade700,
        statusBg: Colors.green.shade50,
        icon: Icons.task_alt,
        iconColor: Colors.green.shade600,
        iconBg: Colors.green.shade50,
        cancelled: false,
      ),
      _TripItem(
        destination: 'Clinique du Parc',
        date: '22 Avril · 09h15',
        status: 'Terminé',
        statusColor: Colors.green.shade700,
        statusBg: Colors.green.shade50,
        icon: Icons.task_alt,
        iconColor: Colors.green.shade600,
        iconBg: Colors.green.shade50,
        cancelled: false,
      ),
      _TripItem(
        destination: 'Laboratoire Bio-Azuro',
        date: '18 Avril · 11h00',
        status: 'Annulé',
        statusColor: const Color(0xFFDC2626),
        statusBg: const Color(0xFFFEF2F2),
        icon: Icons.cancel,
        iconColor: const Color(0xFFDC2626),
        iconBg: const Color(0xFFFEF2F2),
        cancelled: true,
      ),
    ];

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Derniers transports',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
            ),
            TextButton(
              onPressed: () {},
              child: const Text('Tout voir', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...trips.map((t) => Opacity(
          opacity: t.cancelled ? 0.75 : 1.0,
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade100),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                // Icon
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: t.iconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(t.icon, color: t.iconColor, size: 22),
                ),
                const SizedBox(width: 14),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.destination,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
                      ),
                      const SizedBox(height: 2),
                      Text(t.date, style: const TextStyle(fontSize: 12, color: AppTheme.secondary)),
                    ],
                  ),
                ),
                // Status
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: t.statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        t.status,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: t.statusColor),
                      ),
                    ),
                    if (!t.cancelled) ...[
                      const SizedBox(height: 4),
                      const Icon(Icons.chevron_right, color: Colors.black12, size: 18),
                    ],
                  ],
                ),
              ],
            ),
          ),
        )),
      ],
    );
  }

  // ── Section 5 — Map ────────────────────────────────────────────────────────
  Widget _buildMapSection() {
    return Container(
      height: 148,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFFBFD7FF),
            AppTheme.primaryFixed,
            const Color(0xFFE8F0FE),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative grid pattern
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CustomPaint(painter: _MapGridPainter()),
            ),
          ),
          // Gradient overlay bottom
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              height: 72,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.white.withOpacity(0.85)],
                ),
              ),
            ),
          ),
          // Pin icon
          const Positioned(
            top: 30, left: 0, right: 0,
            child: Icon(Icons.location_on, color: Color(0xFF0056CB), size: 36),
          ),
          // Label
          Positioned(
            bottom: 12, left: 14, right: 14,
            child: Row(
              children: const [
                Icon(Icons.location_on, size: 14, color: AppTheme.secondary),
                SizedBox(width: 4),
                Text(
                  'Zone de service active : Nice et environs',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.secondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: _buildAppBar(),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNav(),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _NavItem {
  final IconData icon;
  final IconData filledIcon;
  final String label;
  const _NavItem({required this.icon, required this.filledIcon, required this.label});
}

class _QuickAction {
  final IconData icon;
  final String label;
  final Color bgColor;
  final Color iconColor;
  final Color textColor;
  final bool filled;
  const _QuickAction({
    required this.icon, required this.label, required this.bgColor,
    required this.iconColor, required this.textColor, required this.filled,
  });
}

class _TripItem {
  final String destination;
  final String date;
  final String status;
  final Color statusColor;
  final Color statusBg;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final bool cancelled;
  const _TripItem({
    required this.destination, required this.date, required this.status,
    required this.statusColor, required this.statusBg, required this.icon,
    required this.iconColor, required this.iconBg, required this.cancelled,
  });
}

// Decorative map grid painter
class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.35)
      ..strokeWidth = 1;
    const step = 28.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    // Simulated roads
    final roadPaint = Paint()
      ..color = Colors.white.withOpacity(0.6)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(0, size.height * 0.4), Offset(size.width, size.height * 0.4), roadPaint);
    canvas.drawLine(Offset(size.width * 0.35, 0), Offset(size.width * 0.35, size.height), roadPaint);
    canvas.drawLine(Offset(size.width * 0.7, 0), Offset(size.width * 0.7, size.height), roadPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
