import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../screens/factures_screen.dart';
import '../screens/prescriptions_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/transports_screen.dart';

/// Barre de navigation partagée entre tous les écrans secondaires.
/// [activeIndex] : 0=Accueil, 1=Transports, 2=Factures, 3=Ordonnances, 4=Profil
class AppBottomNav extends StatelessWidget {
  final int activeIndex;

  const AppBottomNav({super.key, required this.activeIndex});

  static const _icons = [
    (icon: Icons.home_outlined,             filled: Icons.home,             label: 'Accueil'),
    (icon: Icons.medical_services_outlined, filled: Icons.medical_services, label: 'Transports'),
    (icon: Icons.receipt_long_outlined,     filled: Icons.receipt_long,     label: 'Factures'),
    (icon: Icons.description_outlined,      filled: Icons.description,      label: 'Ordonnances'),
    (icon: Icons.person_outline,            filled: Icons.person,           label: 'Profil'),
  ];

  void _navigate(BuildContext context, int index) {
    if (index == activeIndex) return;

    if (index == 0) {
      // Retour direct à l'accueil
      Navigator.of(context).popUntil((route) => route.isFirst);
      return;
    }

    final Widget target;
    switch (index) {
      case 1:
        target = const TransportsScreen();
      case 2:
        target = const FacturesScreen();
      case 3:
        target = const PrescriptionsScreen();
      case 4:
        target = const ProfileScreen();
      default:
        return;
    }

    // Remplace le stack courant : HomeScreen → TargetScreen (back = HomeScreen)
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => target),
      (route) => route.isFirst,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(_icons.length, (i) {
              final active = i == activeIndex;
              final item   = _icons[i];
              return GestureDetector(
                onTap: () => _navigate(context, i),
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
                        active ? item.filled : item.icon,
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
}
