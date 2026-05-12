import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/status_cubit.dart';
import '../../navigation/navigation_helper.dart';
import '../../documents/screens/signature_screen.dart';
import '../../documents/screens/pmt_photo_screen.dart';
import '../../../shared/theme/app_theme.dart';

class TransportDetailScreen extends StatelessWidget {
  final Map<String, dynamic> transport;
  const TransportDetailScreen({super.key, required this.transport});

  static const _steps = [
    {'status': 'ASSIGNED',               'label': 'Assigné',          'icon': Icons.assignment},
    {'status': 'EN_ROUTE_TO_PICKUP',     'label': 'En route',         'icon': Icons.directions_car},
    {'status': 'ARRIVED_AT_PICKUP',      'label': 'Arrivé patient',   'icon': Icons.person_pin_circle},
    {'status': 'PATIENT_ON_BOARD',       'label': 'Patient à bord',   'icon': Icons.airline_seat_recline_normal},
    {'status': 'ARRIVED_AT_DESTINATION', 'label': 'À destination',    'icon': Icons.local_hospital},
    {'status': 'COMPLETED',              'label': 'Terminé',          'icon': Icons.check_circle},
  ];

  static const _nextAction = {
    'ASSIGNED':               'Partir',
    'EN_ROUTE_TO_PICKUP':     'Arrivé au patient',
    'ARRIVED_AT_PICKUP':      'Patient à bord',
    'PATIENT_ON_BOARD':       'Arrivé à destination',
    'ARRIVED_AT_DESTINATION': 'Terminer',
  };

  static const _nextStatus = {
    'ASSIGNED':               'EN_ROUTE_TO_PICKUP',
    'EN_ROUTE_TO_PICKUP':     'ARRIVED_AT_PICKUP',
    'ARRIVED_AT_PICKUP':      'PATIENT_ON_BOARD',
    'PATIENT_ON_BOARD':       'ARRIVED_AT_DESTINATION',
    'ARRIVED_AT_DESTINATION': 'COMPLETED',
  };

  String _fmtAdresse(dynamic a) {
    if (a == null) return '—';
    if (a is String) return a;
    final m = a as Map;
    return [m['nom'], m['rue'], m['ville']].where((s) => s != null && s.toString().isNotEmpty).join(', ');
  }

  double? _lat(dynamic a) {
    if (a is! Map) return null;
    final coords = a['coordonnees'];
    if (coords is! Map) return null;
    return (coords['lat'] as num?)?.toDouble();
  }

  double? _lng(dynamic a) {
    if (a is! Map) return null;
    final coords = a['coordonnees'];
    if (coords is! Map) return null;
    return (coords['lng'] as num?)?.toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final id     = (transport['_id'] ?? transport['id'] ?? '') as String;
    final statut = transport['statut'] as String? ?? 'ASSIGNED';
    final patient = transport['patient'] as Map? ?? {};

    return BlocProvider(
      create: (_) => StatusCubit(transportId: id, currentStatus: statut),
      child: Builder(builder: (ctx) => _buildBody(ctx, patient, statut)),
    );
  }

  Widget _buildBody(BuildContext context, Map patient, String initialStatus) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(transport['numero'] as String? ?? '—'),
        actions: [
          IconButton(
            icon: const Icon(Icons.report_problem_outlined),
            tooltip: 'Signaler un incident',
            onPressed: () => _showIncidentDialog(context),
          ),
        ],
      ),
      body: BlocConsumer<StatusCubit, StatusState>(
        listener: (context, state) {
          if (state is StatusOfflineQueued) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('Hors ligne — sera synchronisé à la reconnexion'),
              backgroundColor: AppTheme.warning,
            ));
          }
        },
        builder: (context, state) {
          final cubit   = context.read<StatusCubit>();
          final current = cubit.currentStatus;
          final action  = _nextAction[current];
          final next    = _nextStatus[current];
          final busy    = state is StatusUpdating;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Patient card
                _card(children: [
                  _section('Patient', Icons.person),
                  const SizedBox(height: 8),
                  _row('Nom', '${patient['prenom'] ?? ''} ${patient['nom'] ?? ''}'.trim()),
                  _row('Mobilité', patient['mobilite'] as String? ?? '—'),
                  if ((patient['antecedents'] as String? ?? '').isNotEmpty)
                    _row('Antécédents', patient['antecedents'] as String),
                ]),
                const SizedBox(height: 12),

                // Addresses
                _card(children: [
                  _section('Trajet', Icons.route),
                  const SizedBox(height: 10),
                  _adresseRow(context, 'Départ', transport['adresseDepart'], AppTheme.primary, isPickup: true),
                  const Padding(padding: EdgeInsets.symmetric(vertical: 4), child: Divider()),
                  _adresseRow(context, 'Destination', transport['adresseDestination'], AppTheme.error, isPickup: false),
                ]),
                const SizedBox(height: 12),

                // Status timeline
                _card(children: [
                  _section('Progression', Icons.linear_scale),
                  const SizedBox(height: 12),
                  ..._steps.map((s) => _stepRow(s['status'] as String, s['label'] as String, s['icon'] as IconData, context.read<StatusCubit>().currentStatus)),
                ]),
                const SizedBox(height: 12),

                // Notes
                if ((transport['notes'] as String? ?? '').isNotEmpty)
                  _card(children: [
                    _section('Notes', Icons.notes),
                    const SizedBox(height: 8),
                    Text(transport['notes'] as String, style: const TextStyle(fontSize: 13, color: AppTheme.secondary)),
                  ]),

                const SizedBox(height: 16),

                // Action button
                if (action != null)
                  ElevatedButton.icon(
                    onPressed: busy || next == null ? null : () => context.read<StatusCubit>().update(next),
                    icon: busy
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.arrow_forward),
                    label: Text(busy ? 'Mise à jour...' : action),
                  ),

                // Signature + PMT after completion
                if (current == 'ARRIVED_AT_DESTINATION' || current == 'COMPLETED') ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => SignatureScreen(transportId: (transport['_id'] ?? transport['id']) as String),
                    )),
                    icon: const Icon(Icons.draw),
                    label: const Text('Signature patient'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => PmtPhotoScreen(transportId: (transport['_id'] ?? transport['id']) as String),
                    )),
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: const Text('Photo PMT'),
                  ),
                ],
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _adresseRow(BuildContext context, String label, dynamic adresse, Color color, {required bool isPickup}) {
    final lat = isPickup ? _lat(adresse) : _lat(adresse);
    final lng = isPickup ? _lng(adresse) : _lng(adresse);
    return Row(
      children: [
        Icon(isPickup ? Icons.radio_button_on : Icons.location_on, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.secondary, fontWeight: FontWeight.w500)),
            Text(_fmtAdresse(adresse), style: const TextStyle(fontSize: 13, color: AppTheme.onSurface)),
          ],
        )),
        if (lat != null && lng != null)
          IconButton(
            icon: Icon(Icons.navigation_outlined, color: color),
            onPressed: () => NavigationHelper.showChoice(context, lat, lng, _fmtAdresse(adresse)),
          ),
      ],
    );
  }

  Widget _stepRow(String status, String label, IconData icon, String current) {
    final stepIdx    = _steps.indexWhere((s) => s['status'] == status);
    final currentIdx = _steps.indexWhere((s) => s['status'] == current);
    final done    = stepIdx < currentIdx;
    final active  = stepIdx == currentIdx;
    final pending = stepIdx > currentIdx;

    final color = done ? AppTheme.success : active ? AppTheme.primary : Colors.grey.shade300;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Icon(icon, size: 14, color: done || active ? Colors.white : Colors.grey.shade500),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: active ? FontWeight.w700 : FontWeight.w400,
              color: pending ? Colors.grey.shade400 : AppTheme.onSurface,
            ),
          ),
          if (active) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
              child: const Text('Actuel', style: TextStyle(fontSize: 10, color: AppTheme.primary, fontWeight: FontWeight.w600)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.grey.shade100),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _section(String title, IconData icon) => Row(
    children: [
      Icon(icon, size: 16, color: AppTheme.primary),
      const SizedBox(width: 6),
      Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
    ],
  );

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      children: [
        SizedBox(width: 90, child: Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.secondary))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.onSurface))),
      ],
    ),
  );

  void _showIncidentDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Signaler un incident'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(hintText: 'Description...'), maxLines: 3),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              // handled by ShiftCubit if needed
            },
            child: const Text('Signaler'),
          ),
        ],
      ),
    );
  }
}
