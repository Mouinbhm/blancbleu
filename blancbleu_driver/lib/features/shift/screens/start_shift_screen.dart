import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/shift_cubit.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/theme/app_theme.dart';

class StartShiftScreen extends StatefulWidget {
  const StartShiftScreen({super.key});
  @override
  State<StartShiftScreen> createState() => _StartShiftScreenState();
}

class _StartShiftScreenState extends State<StartShiftScreen> {
  String? _vehicleId;
  List<dynamic> _vehicles = [];
  bool _loadingVehicles = true;

  final Map<String, bool> _checklist = {
    'fuel':        false,
    'tires':       false,
    'medicalKit':  false,
    'stretcher':   false,
    'cleanliness': false,
  };

  static const _checklistLabels = {
    'fuel':        'Carburant vérifié',
    'tires':       'Pneus OK',
    'medicalKit':  'Kit médical complet',
    'stretcher':   'Brancard opérationnel',
    'cleanliness': 'Véhicule propre',
  };

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  Future<void> _loadVehicles() async {
    try {
      final data = await ApiClient.instance.getVehicles();
      if (mounted) setState(() { _vehicles = data; _loadingVehicles = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingVehicles = false);
    }
  }

  void _start() {
    if (_vehicleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sélectionnez un véhicule')));
      return;
    }
    context.read<ShiftCubit>().start(_vehicleId!, _checklist);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Démarrer le shift')),
      body: BlocListener<ShiftCubit, ShiftState>(
        listener: (context, state) {
          if (state is ShiftActive) Navigator.pop(context);
          if (state is ShiftError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message), backgroundColor: AppTheme.error));
          }
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Vehicle selector
              const Text('Véhicule', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
              const SizedBox(height: 8),
              _loadingVehicles
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : DropdownButtonFormField<String>(
                      value: _vehicleId,
                      hint: const Text('Sélectionner un véhicule'),
                      decoration: const InputDecoration(),
                      items: _vehicles.map<DropdownMenuItem<String>>((v) {
                        final id   = v['_id']?.toString() ?? v['id']?.toString() ?? '';
                        final label = '${v['immatriculation'] ?? ''} — ${v['type'] ?? ''}';
                        return DropdownMenuItem(value: id, child: Text(label));
                      }).toList(),
                      onChanged: (val) => setState(() => _vehicleId = val),
                    ),

              const SizedBox(height: 24),
              const Text('Checklist pré-départ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
              const SizedBox(height: 8),
              ..._checklistLabels.entries.map((e) => CheckboxListTile(
                value: _checklist[e.key],
                onChanged: (v) => setState(() => _checklist[e.key] = v ?? false),
                title: Text(e.value, style: const TextStyle(fontSize: 14)),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                activeColor: AppTheme.primary,
              )),

              const SizedBox(height: 32),
              BlocBuilder<ShiftCubit, ShiftState>(
                builder: (context, state) => ElevatedButton.icon(
                  onPressed: state is ShiftLoading ? null : _start,
                  icon: state is ShiftLoading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.play_arrow),
                  label: const Text('Démarrer le shift'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
