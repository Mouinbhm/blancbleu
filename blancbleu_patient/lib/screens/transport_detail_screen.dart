import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/theme.dart';
import '../services/api_service.dart';
import 'tracking_screen.dart';

class TransportDetailScreen extends StatefulWidget {
  final String transportId;

  const TransportDetailScreen({super.key, required this.transportId});

  @override
  State<TransportDetailScreen> createState() => _TransportDetailScreenState();
}

class _TransportDetailScreenState extends State<TransportDetailScreen> {
  bool                    _loading = true;
  String?                 _error;
  Map<String, dynamic>?   _transport;

  static const _moisLong = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ];
  static const _jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      setState(() { _loading = true; _error = null; });
      final t = await ApiService.getTransportById(widget.transportId);
      if (!mounted) return;
      setState(() { _transport = t; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  String _fmtDateLong(String? iso, String? heure) {
    if (iso == null) return '--';
    final d = DateTime.parse(iso).toLocal();
    final jour = _jours[d.weekday - 1];
    final mois = _moisLong[d.month - 1];
    final h    = (heure ?? '').replaceAll(':', 'h');
    return '$jour ${d.day} $mois ${d.year}${h.isNotEmpty ? ' a ${h}' : ''}';
  }

  static Map<String, dynamic> _statutInfo(String statut) {
    switch (statut) {
      case 'REQUESTED':          return {'label': 'En attente',      'color': Colors.orange.shade700, 'bg': Colors.orange.shade50};
      case 'CONFIRMED':          return {'label': 'Confirme',        'color': const Color(0xFF2563EB), 'bg': const Color(0xFFEFF6FF)};
      case 'SCHEDULED':
      case 'ASSIGNED':           return {'label': 'Planifie',        'color': Colors.purple.shade700, 'bg': Colors.purple.shade50};
      case 'EN_ROUTE_TO_PICKUP': return {'label': 'En route',        'color': AppTheme.primaryContainer, 'bg': const Color(0xFFEFF6FF)};
      case 'ARRIVED_AT_PICKUP':  return {'label': 'Arrive depart',   'color': AppTheme.primaryContainer, 'bg': const Color(0xFFEFF6FF)};
      case 'PATIENT_ON_BOARD':   return {'label': 'A bord',          'color': AppTheme.primaryContainer, 'bg': const Color(0xFFEFF6FF)};
      case 'ARRIVED_AT_DESTINATION': return {'label': 'Arrive dest.', 'color': Colors.teal.shade700, 'bg': Colors.teal.shade50};
      case 'COMPLETED':
      case 'BILLED':             return {'label': 'Termine',         'color': Colors.green.shade700, 'bg': Colors.green.shade50};
      case 'CANCELLED':          return {'label': 'Annule',          'color': const Color(0xFFDC2626), 'bg': const Color(0xFFFEF2F2)};
      case 'NO_SHOW':            return {'label': 'Non presente',    'color': Colors.grey.shade600, 'bg': Colors.grey.shade100};
      default:                   return {'label': statut,            'color': Colors.grey.shade600, 'bg': Colors.grey.shade100};
    }
  }

  bool _isActif(String? s) => [
    'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'PATIENT_ON_BOARD',
  ].contains(s);

  // ── Info row ───────────────────────────────────────────────────────────────
  Widget _row(IconData icon, String label, String value, {Color? iconColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: const Color(0xFFF2F3FE), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 18, color: iconColor ?? AppTheme.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label.toUpperCase(),
                    style: const TextStyle(fontSize: 10, color: AppTheme.secondary,
                        fontWeight: FontWeight.w600, letterSpacing: 0.6)),
                const SizedBox(height: 3),
                Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(height: 1, color: Color(0xFFF0F0F0));

  @override
  Widget build(BuildContext context) {
    final t      = _transport;
    final statut = (t?['statut'] as String?) ?? '';
    final si     = t != null ? _statutInfo(statut) : <String, dynamic>{};
    final actif  = _isActif(statut);

    final dest    = (t?['adresseDestination']?['nom']  as String?)
                 ?? (t?['adresseDestination']?['ville'] as String?)
                 ?? 'Destination';
    final depart  = (t?['adresseDepart']?['nom']       as String?) ?? '--';
    final dateStr = _fmtDateLong(t?['dateTransport'] as String?, t?['heureRDV'] as String?);
    final motif   = (t?['motif']        as String?) ?? '--';
    final type    = (t?['typeTransport'] as String?) ?? '--';
    final allerR  = (t?['allerRetour']  as bool?) ?? false;
    final notes   = (t?['notes']        as String?) ?? '';

    final vehicule    = t?['vehicule'];
    final chauffeur   = t?['chauffeur'];
    final veNom       = (vehicule?['nom']            as String?) ?? '';
    final veImmat     = (vehicule?['immatriculation'] as String?) ?? '';
    final veType      = (vehicule?['type']           as String?) ?? '';
    final chNom       = chauffeur != null
        ? '${(chauffeur['prenom'] as String?) ?? ''} ${(chauffeur['nom'] as String?) ?? ''}'.trim()
        : '';
    final chTel       = (chauffeur?['telephone'] as String?) ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: const Text(
          'Detail du transport',
          style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 18),
        ),
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppTheme.primary),
        ),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_outlined, color: Colors.grey)),
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppTheme.secondary),
                        const SizedBox(height: 16),
                        Text(_error!, textAlign: TextAlign.center,
                            style: const TextStyle(color: AppTheme.secondary, fontSize: 14)),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: _load,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryContainer, foregroundColor: Colors.white),
                          child: const Text('Reessayer'),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Status banner ────────────────────────────────────
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 4))],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    dest,
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700,
                                        color: AppTheme.onSurface, letterSpacing: -0.3),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: si['bg'] as Color? ?? Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    si['label'] as String? ?? statut,
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                                        color: si['color'] as Color? ?? Colors.grey),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(dateStr, style: const TextStyle(fontSize: 14, color: AppTheme.secondary)),
                            if (allerR) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF3E8FF),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.swap_horiz, size: 14, color: Colors.purple),
                                    SizedBox(width: 4),
                                    Text('Aller-retour', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.purple)),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),

                      // ── Trajet ───────────────────────────────────────────
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white, borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Column(
                            children: [
                              _row(Icons.location_on, 'Depart', depart, iconColor: AppTheme.primaryContainer),
                              _divider(),
                              _row(Icons.local_hospital, 'Destination', dest, iconColor: const Color(0xFFBA1A1A)),
                              _divider(),
                              _row(Icons.calendar_today, 'Date et heure', dateStr),
                              _divider(),
                              _row(Icons.medical_information_outlined, 'Motif', motif),
                              _divider(),
                              _row(Icons.directions_car, 'Type de vehicule', type),
                              if (notes.isNotEmpty) ...[
                                _divider(),
                                _row(Icons.notes, 'Notes', notes),
                              ],
                            ],
                          ),
                        ),
                      ),

                      // ── Vehicule / Chauffeur ─────────────────────────────
                      if (veNom.isNotEmpty || chNom.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white, borderRadius: BorderRadius.circular(16),
                            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Column(
                              children: [
                                if (veNom.isNotEmpty) ...[
                                  _row(Icons.directions_car_outlined, 'Vehicule',
                                      '${veNom}${veImmat.isNotEmpty ? ' · $veImmat' : ''}${veType.isNotEmpty ? ' ($veType)' : ''}'),
                                ],
                                if (veNom.isNotEmpty && chNom.isNotEmpty) _divider(),
                                if (chNom.isNotEmpty) ...[
                                  _row(Icons.person_pin, 'Chauffeur', chNom),
                                  if (chTel.isNotEmpty) ...[
                                    _divider(),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 36, height: 36,
                                            decoration: BoxDecoration(color: const Color(0xFFF2F3FE), borderRadius: BorderRadius.circular(8)),
                                            child: const Icon(Icons.phone, size: 18, color: AppTheme.primary),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('TELEPHONE', style: TextStyle(fontSize: 10, color: AppTheme.secondary, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
                                                const SizedBox(height: 3),
                                                Text(chTel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
                                              ],
                                            ),
                                          ),
                                          GestureDetector(
                                            onTap: () {
                                              Clipboard.setData(ClipboardData(text: chTel));
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(content: Text('Copie : $chTel'), duration: const Duration(seconds: 2)),
                                              );
                                            },
                                            child: Container(
                                              padding: const EdgeInsets.all(8),
                                              decoration: BoxDecoration(
                                                border: Border.all(color: const Color(0xFFE5E7EB)),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Icon(Icons.content_copy, size: 18, color: AppTheme.secondary),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),

                      // ── CTA Tracking ─────────────────────────────────────
                      if (actif)
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton.icon(
                            onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => TrackingScreen(
                                  transportId: widget.transportId,
                                  transport: t!,
                                ),
                              ),
                            ),
                            icon: const Icon(Icons.location_on, size: 22),
                            label: const Text('Suivre le trajet en direct',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryContainer,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              elevation: 4,
                              shadowColor: AppTheme.primaryContainer.withOpacity(0.4),
                            ),
                          ),
                        ),

                      const SizedBox(height: 8),
                    ],
                  ),
                ),
    );
  }
}
