import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../transport/screens/transport_detail_screen.dart';
import '../cubit/tournee_cubit.dart';
import '../../../shared/theme/app_theme.dart';

class TransportCard extends StatelessWidget {
  final Map<String, dynamic> transport;
  const TransportCard({super.key, required this.transport});

  static const _statusConfig = {
    'ASSIGNED':              {'label': 'Assigné',         'color': 0xFF7C3AED, 'bg': 0xFFF5F3FF},
    'EN_ROUTE_TO_PICKUP':    {'label': 'En route',        'color': 0xFFF59E0B, 'bg': 0xFFFFFBEB},
    'ARRIVED_AT_PICKUP':     {'label': 'Arrivé patient',  'color': 0xFF2563EB, 'bg': 0xFFEFF6FF},
    'PATIENT_ON_BOARD':      {'label': 'Patient à bord',  'color': 0xFF0D9488, 'bg': 0xFFF0FDFA},
    'ARRIVED_AT_DESTINATION':{'label': 'À destination',   'color': 0xFF059669, 'bg': 0xFFF0FDF4},
    'COMPLETED':             {'label': 'Terminé',         'color': 0xFF6B7280, 'bg': 0xFFF9FAFB},
    'CANCELLED':             {'label': 'Annulé',          'color': 0xFFDC2626, 'bg': 0xFFFEF2F2},
  };

  String _fmtAdresse(dynamic a) {
    if (a == null) return '—';
    if (a is String) return a;
    final m = a as Map;
    return [m['nom'], m['rue'], m['ville']].where((s) => s != null && s.toString().isNotEmpty).join(', ');
  }

  String _fmtHeure(dynamic h) => h?.toString().substring(0, 5) ?? '--:--';

  @override
  Widget build(BuildContext context) {
    final statut = transport['statut'] as String? ?? 'ASSIGNED';
    final cfg = _statusConfig[statut] ?? {'label': statut, 'color': 0xFF6B7280, 'bg': 0xFFF9FAFB};
    final patient = transport['patient'] as Map? ?? {};
    final patientNom = '${patient['prenom'] ?? ''} ${patient['nom'] ?? ''}'.trim();

    return GestureDetector(
      onTap: () {
        final tourneeCubit = context.read<TourneeCubit>();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: tourneeCubit,
              child: TransportDetailScreen(transport: transport),
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Color(cfg['bg'] as int),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _fmtHeure(transport['heureRDV']),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(cfg['color'] as int)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      patientNom.isNotEmpty ? patientNom : '—',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.onSurface),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Color(cfg['bg'] as int),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      cfg['label'] as String,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(cfg['color'] as int)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _adresseRow(Icons.radio_button_on, _fmtAdresse(transport['adresseDepart']), AppTheme.primary),
              const SizedBox(height: 4),
              _adresseRow(Icons.location_on, _fmtAdresse(transport['adresseDestination']), AppTheme.error),
            ],
          ),
        ),
      ),
    );
  }

  Widget _adresseRow(IconData icon, String text, Color color) => Row(
    children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: 6),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 12, color: AppTheme.secondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
    ],
  );
}
