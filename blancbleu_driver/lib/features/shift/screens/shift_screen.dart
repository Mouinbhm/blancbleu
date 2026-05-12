import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/shift_cubit.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/theme/app_theme.dart';

class ShiftScreen extends StatefulWidget {
  const ShiftScreen({super.key});

  @override
  State<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends State<ShiftScreen> {
  String? _vehicleId;
  List<dynamic> _vehicles = [];
  bool _loadingVehicles = true;

  final _kmController = TextEditingController();
  final _notesController = TextEditingController();

  final Map<String, bool> _checklist = {
    'fuel':        false,
    'tires':       false,
    'medicalKit':  false,
    'stretcher':   false,
    'cleanliness': false,
    'documents':   false,
  };

  static const _checklistLabels = {
    'fuel':        'Carburant vérifié',
    'tires':       'Pneus OK',
    'medicalKit':  'Kit médical complet',
    'stretcher':   'Brancard opérationnel',
    'cleanliness': 'Véhicule propre',
    'documents':   'Documents à bord',
  };

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  @override
  void dispose() {
    _kmController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadVehicles() async {
    try {
      final data = await ApiClient.instance.getAvailableVehicles();
      if (mounted) setState(() { _vehicles = data; _loadingVehicles = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingVehicles = false);
    }
  }

  void _start() {
    if (_vehicleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sélectionnez un véhicule')),
      );
      return;
    }
    context.read<ShiftCubit>().start(_vehicleId!, _checklist);
  }

  void _confirmEnd(Map<String, dynamic> shift) {
    _kmController.clear();
    _notesController.clear();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Terminer le shift'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _kmController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Kilométrage total (optionnel)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: 'Notes (optionnel)'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<ShiftCubit>().end(
                totalKm: int.tryParse(_kmController.text) ?? 0,
                notes: _notesController.text,
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Terminer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ShiftCubit, ShiftState>(
      listener: (context, state) {
        if (state is ShiftActive) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Shift démarré'),
            backgroundColor: AppTheme.primary,
          ));
        }
        if (state is ShiftEnded) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Shift terminé')),
          );
          setState(() {
            _vehicleId = null;
            _loadingVehicles = true;
            _checklist.updateAll((_, __) => false);
          });
          _loadVehicles();
        }
        if (state is ShiftError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: AppTheme.error,
          ));
        }
      },
      child: BlocBuilder<ShiftCubit, ShiftState>(
        builder: (context, state) {
          if (state is ShiftActive) return _buildActive(state.shift);
          return _buildStartForm(state);
        },
      ),
    );
  }

  Widget _buildActive(Map<String, dynamic> shift) {
    final vehicleInfo = shift['vehicleId'];
    final plate       = vehicleInfo is Map ? vehicleInfo['immatriculation']?.toString() ?? '' : '';
    final vehicleType = vehicleInfo is Map ? vehicleInfo['type']?.toString() ?? '' : '';
    final rawStart    = shift['startTime'];
    String startTime  = '—';
    if (rawStart != null) {
      try {
        final dt = DateTime.parse(rawStart.toString()).toLocal();
        startTime = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {}
    }
    final transportCount = shift['transportCount'] ?? 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mon shift', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF6EE7B7)),
            ),
            child: Row(
              children: [
                Container(
                  width: 10, height: 10,
                  decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Shift en cours',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF065F46))),
                      const SizedBox(height: 2),
                      Text('Depuis $startTime · $transportCount transport${transportCount != 1 ? 's' : ''}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF047857))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text('Véhicule assigné',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.secondary)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.directions_car, color: AppTheme.primary, size: 24),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(plate.isNotEmpty ? plate : '—',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
                    if (vehicleType.isNotEmpty)
                      Text(vehicleType, style: const TextStyle(fontSize: 12, color: AppTheme.secondary)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity,
            child: BlocBuilder<ShiftCubit, ShiftState>(
              builder: (context, state) => ElevatedButton.icon(
                onPressed: state is ShiftLoading ? null : () => _confirmEnd(shift),
                icon: state is ShiftLoading
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.stop_circle_outlined),
                label: const Text('Terminer le shift'),
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartForm(ShiftState state) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Démarrer mon shift',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
          const SizedBox(height: 4),
          const Text('Sélectionnez votre véhicule et vérifiez la checklist avant de démarrer.',
            style: TextStyle(fontSize: 13, color: AppTheme.secondary)),
          const SizedBox(height: 24),

          const Text('Véhicule',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
          const SizedBox(height: 8),
          if (_loadingVehicles)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: CircularProgressIndicator(color: AppTheme.primary),
              ),
            )
          else if (_vehicles.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                border: Border.all(color: const Color(0xFFFED7AA)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Color(0xFFF97316), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Aucun véhicule disponible — contactez le dispatcher',
                      style: TextStyle(fontSize: 13, color: Color(0xFF9A3412)),
                    ),
                  ),
                ],
              ),
            )
          else
            DropdownButtonFormField<String>(
              value: _vehicleId,
              hint: const Text('Sélectionner un véhicule disponible'),
              decoration: const InputDecoration(),
              items: _vehicles.map<DropdownMenuItem<String>>((v) {
                final id    = v['_id']?.toString() ?? v['id']?.toString() ?? '';
                final plate = v['immatriculation']?.toString() ?? '';
                final brand = v['marque']?.toString() ?? '';
                final model = v['modele']?.toString() ?? '';
                final type  = v['type']?.toString() ?? '';
                final label = [plate, if (brand.isNotEmpty) '$brand $model', type].join(' — ');
                return DropdownMenuItem(value: id, child: Text(label));
              }).toList(),
              onChanged: (val) => setState(() => _vehicleId = val),
            ),

          const SizedBox(height: 24),
          const Text('Checklist pré-départ',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.onSurface)),
          const SizedBox(height: 4),
          ..._checklistLabels.entries.map((e) => CheckboxListTile(
            value: _checklist[e.key],
            onChanged: (v) => setState(() => _checklist[e.key] = v ?? false),
            title: Text(e.value, style: const TextStyle(fontSize: 14)),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            activeColor: AppTheme.primary,
          )),

          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: BlocBuilder<ShiftCubit, ShiftState>(
              builder: (context, st) => ElevatedButton.icon(
                onPressed: (_vehicles.isEmpty || st is ShiftLoading) ? null : _start,
                icon: st is ShiftLoading
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.play_arrow),
                label: const Text('Démarrer le shift'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
