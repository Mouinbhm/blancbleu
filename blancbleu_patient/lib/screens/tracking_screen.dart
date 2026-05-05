import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/theme.dart';
import '../services/api_service.dart';

class TrackingScreen extends StatefulWidget {
  final String              transportId;
  final Map<String, dynamic> transport;

  const TrackingScreen({
    super.key,
    required this.transportId,
    required this.transport,
  });

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  bool                   _loading  = true;
  String?                _error;
  Map<String, dynamic>?  _tracking;

  static const _steps = [
    {'statut': 'ASSIGNED',           'label': 'Chauffeur assigne',     'icon': Icons.person_pin},
    {'statut': 'EN_ROUTE_TO_PICKUP', 'label': 'Chauffeur en route',    'icon': Icons.directions_car},
    {'statut': 'ARRIVED_AT_PICKUP',  'label': 'Arrive a votre adresse','icon': Icons.location_on},
    {'statut': 'PATIENT_ON_BOARD',   'label': 'Vous etes a bord',      'icon': Icons.airline_seat_recline_normal},
    {'statut': 'ARRIVED_AT_DESTINATION','label': 'Arrive a destination','icon': Icons.local_hospital},
    {'statut': 'COMPLETED',          'label': 'Transport termine',     'icon': Icons.check_circle},
  ];

  static const _statutOrder = [
    'REQUESTED', 'CONFIRMED', 'SCHEDULED', 'ASSIGNED',
    'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'PATIENT_ON_BOARD',
    'ARRIVED_AT_DESTINATION', 'COMPLETED', 'BILLED',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      setState(() { _loading = true; _error = null; });
      final t = await ApiService.getTracking(widget.transportId);
      if (!mounted) return;
      setState(() { _tracking = t; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error   = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  int _statutIndex(String? s) {
    final i = _statutOrder.indexOf(s ?? '');
    return i < 0 ? 0 : i;
  }

  bool _stepDone(String stepStatut, String currentStatut) {
    return _statutIndex(currentStatut) > _statutIndex(stepStatut);
  }

  bool _stepActive(String stepStatut, String currentStatut) {
    return currentStatut == stepStatut;
  }

  // ── ETA banner ─────────────────────────────────────────────────────────────
  Widget _buildEtaBanner(int? etaMinutes) {
    if (etaMinutes == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primaryContainer, Color(0xFF0056CB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: AppTheme.primary.withOpacity(0.25), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.timer_outlined, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Temps d\'arrivee estime', style: TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(
                '$etaMinutes min',
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Map placeholder ────────────────────────────────────────────────────────
  Widget _buildMapPlaceholder() {
    return Container(
      height: 180,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [const Color(0xFFBFD7FF), AppTheme.primaryFixed, const Color(0xFFE8F0FE)],
        ),
        boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CustomPaint(painter: _MapPainter()),
            ),
          ),
          const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.directions_car, color: AppTheme.primaryContainer, size: 40),
                SizedBox(height: 8),
                Text(
                  'Suivi en temps reel',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.primary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  Widget _buildTimeline(String currentStatut) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('PROGRESSION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
              color: AppTheme.secondary, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          ...List.generate(_steps.length, (i) {
            final step   = _steps[i];
            final sStat  = step['statut'] as String;
            final done   = _stepDone(sStat, currentStatut);
            final active = _stepActive(sStat, currentStatut);
            final last   = i == _steps.length - 1;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done
                            ? Colors.green.shade500
                            : active
                                ? AppTheme.primaryContainer
                                : Colors.grey.shade200,
                      ),
                      child: Icon(
                        step['icon'] as IconData,
                        size: 18,
                        color: (done || active) ? Colors.white : Colors.grey.shade400,
                      ),
                    ),
                    if (!last)
                      Container(
                        width: 2, height: 32,
                        color: done ? Colors.green.shade300 : Colors.grey.shade200,
                      ),
                  ],
                ),
                const SizedBox(width: 14),
                Padding(
                  padding: const EdgeInsets.only(top: 7, bottom: 16),
                  child: Text(
                    step['label'] as String,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      color: done
                          ? Colors.green.shade700
                          : active
                              ? AppTheme.primaryContainer
                              : Colors.grey.shade500,
                    ),
                  ),
                ),
                if (active) ...[
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: Container(
                      width: 8, height: 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primaryContainer,
                      ),
                    ),
                  ),
                ],
              ],
            );
          }),
        ],
      ),
    );
  }

  // ── Driver card ────────────────────────────────────────────────────────────
  Widget _buildDriverCard(Map<String, dynamic>? chauffeur, Map<String, dynamic>? vehicule) {
    if (chauffeur == null && vehicule == null) return const SizedBox.shrink();

    final chNom  = chauffeur != null
        ? '${(chauffeur['prenom'] as String?) ?? ''} ${(chauffeur['nom'] as String?) ?? ''}'.trim()
        : '';
    final chTel  = (chauffeur?['telephone'] as String?) ?? '';
    final veNom  = (vehicule?['nom']           as String?) ?? '';
    final veType = (vehicule?['type']           as String?) ?? '';
    final veImmat= (vehicule?['immatriculation'] as String?) ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('VEHICULE ET CHAUFFEUR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                color: AppTheme.secondary, letterSpacing: 1.2)),
            const SizedBox(height: 14),
            if (veNom.isNotEmpty)
              Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.directions_car, color: AppTheme.primary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(veNom, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
                      if (veImmat.isNotEmpty || veType.isNotEmpty)
                        Text(
                          [if (veType.isNotEmpty) veType, if (veImmat.isNotEmpty) veImmat].join(' · '),
                          style: const TextStyle(fontSize: 12, color: AppTheme.secondary),
                        ),
                    ],
                  ),
                ],
              ),
            if (veNom.isNotEmpty && chNom.isNotEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
            if (chNom.isNotEmpty)
              Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.primaryContainer,
                    ),
                    child: Center(
                      child: Text(
                        chNom.isNotEmpty ? chNom[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(chNom, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
                        if (chTel.isNotEmpty)
                          Text(chTel, style: const TextStyle(fontSize: 12, color: AppTheme.secondary)),
                      ],
                    ),
                  ),
                  if (chTel.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: chTel));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Numero copie : $chTel'), duration: const Duration(seconds: 2)),
                        );
                      },
                      child: Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.content_copy, color: AppTheme.secondary, size: 20),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  // ── Addresses ──────────────────────────────────────────────────────────────
  Widget _buildAddresses() {
    final depart = (_tracking?['adresseDepart']?['nom']   as String?) ?? '--';
    final dest   = (_tracking?['adresseArrivee']?['nom']  as String?) ?? '--';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.location_on, size: 18, color: AppTheme.primaryContainer),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('DEPART', style: TextStyle(fontSize: 10, color: AppTheme.secondary, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
                      Text(depart, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
                    ],
                  ),
                ),
              ],
            ),
            const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider(height: 1)),
            Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.local_hospital, size: 18, color: Color(0xFFBA1A1A)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('DESTINATION', style: TextStyle(fontSize: 10, color: AppTheme.secondary, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
                      Text(dest, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final statut    = (_tracking?['statut']    as String?) ?? (widget.transport['statut'] as String?) ?? '';
    final etaMin    = _tracking?['etaMinutes'] as int?;
    final chauffeur = _tracking?['chauffeur']  as Map<String, dynamic>?;
    final vehicule  = _tracking?['vehicule']   as Map<String, dynamic>?;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: const Text(
          'Suivi du transport',
          style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 18),
        ),
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppTheme.primary),
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: _loading
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  )
                : const Icon(Icons.refresh, color: AppTheme.primary),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off, size: 48, color: AppTheme.secondary),
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
                  _buildEtaBanner(etaMin),
                  _buildMapPlaceholder(),
                  _buildAddresses(),
                  _buildDriverCard(chauffeur, vehicule),
                  _buildTimeline(statut),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Actualiser', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primary,
                        side: const BorderSide(color: AppTheme.primaryContainer, width: 2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withOpacity(0.3)..strokeWidth = 1;
    const step  = 28.0;
    for (double x = 0; x < size.width;  x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    final road = Paint()
      ..color      = Colors.white.withOpacity(0.6)
      ..strokeWidth = 4
      ..strokeCap  = StrokeCap.round;
    canvas.drawLine(Offset(0, size.height * 0.5), Offset(size.width, size.height * 0.5), road);
    canvas.drawLine(Offset(size.width * 0.35, 0), Offset(size.width * 0.35, size.height), road);
    canvas.drawLine(Offset(size.width * 0.7, 0), Offset(size.width * 0.7, size.height), road);

    final car = Paint()..color = AppTheme.primaryContainer;
    canvas.drawCircle(Offset(size.width * 0.35, size.height * 0.5), 8, car);
    canvas.drawCircle(
      Offset(size.width * 0.35, size.height * 0.5), 8,
      Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
