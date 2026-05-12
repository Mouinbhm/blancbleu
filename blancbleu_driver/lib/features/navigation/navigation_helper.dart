import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class NavigationHelper {
  static Future<void> launchGoogleMaps(double lat, double lng, String label) async {
    final uri = Uri.parse('google.navigation:q=$lat,$lng&mode=d');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      final fallback = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
      await launchUrl(fallback, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> launchWaze(double lat, double lng) async {
    final uri = Uri.parse('waze://?ll=$lat,$lng&navigate=yes');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      final fallback = Uri.parse('https://waze.com/ul?ll=$lat,$lng&navigate=yes');
      await launchUrl(fallback, mode: LaunchMode.externalApplication);
    }
  }

  static void showChoice(BuildContext context, double lat, double lng, String label) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Naviguer vers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
              const SizedBox(height: 16),
              _navButton(
                context, 'Google Maps', Icons.map, Colors.green,
                () { Navigator.pop(context); launchGoogleMaps(lat, lng, label); },
              ),
              const SizedBox(height: 10),
              _navButton(
                context, 'Waze', Icons.navigation, const Color(0xFF00CFFF),
                () { Navigator.pop(context); launchWaze(lat, lng); },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _navButton(BuildContext ctx, String label, IconData icon, Color color, VoidCallback onTap) =>
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Row(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(width: 12),
              Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color)),
            ],
          ),
        ),
      );
}
