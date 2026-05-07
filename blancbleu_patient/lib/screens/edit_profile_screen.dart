import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_service.dart';

class EditProfileScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  const EditProfileScreen({super.key, required this.patient});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  late final TextEditingController _tel;
  late final TextEditingController _adresse;
  late final TextEditingController _medecin;
  late final TextEditingController _mutuelle;
  late final TextEditingController _urgNom;
  late final TextEditingController _urgTel;
  late String _mobilite;

  @override
  void initState() {
    super.initState();
    final p   = widget.patient;
    final urg = (p['contactUrgence'] as Map<String, dynamic>?) ?? {};
    _tel      = TextEditingController(text: (p['telephone']  as String?) ?? '');
    _adresse  = TextEditingController(text: (p['adresse']    as String?) ?? '');
    _medecin  = TextEditingController(text: (p['medecin']    as String?) ?? '');
    _mutuelle = TextEditingController(text: (p['mutuelle']   as String?) ?? '');
    _urgNom   = TextEditingController(text: (urg['nom']       as String?) ?? '');
    _urgTel   = TextEditingController(text: (urg['telephone'] as String?) ?? '');
    _mobilite = (p['mobilite'] as String?) ?? 'ASSIS';
  }

  @override
  void dispose() {
    _tel.dispose();
    _adresse.dispose();
    _medecin.dispose();
    _mutuelle.dispose();
    _urgNom.dispose();
    _urgTel.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final result = await ApiService.updateProfil({
        'telephone': _tel.text.trim(),
        'adresse':   _adresse.text.trim(),
        'mobilite':  _mobilite,
        'medecin':   _medecin.text.trim(),
        'mutuelle':  _mutuelle.text.trim(),
        'contactUrgence': {
          'nom':       _urgNom.text.trim(),
          'telephone': _urgTel.text.trim(),
        },
      });
      if (!mounted) return;
      Navigator.pop(context, result['patient']);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: const Text(
          'Modifier le profil',
          style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: AppTheme.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          _saving
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  ),
                )
              : TextButton(
                  onPressed: _save,
                  child: const Text(
                    'Enregistrer',
                    style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
          const SizedBox(width: 4),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _section('PERSO', Icons.person_outline, null, [
              _field('Téléphone', _tel, keyboardType: TextInputType.phone, icon: Icons.phone_outlined),
              _field('Adresse', _adresse, keyboardType: TextInputType.streetAddress, icon: Icons.home_outlined),
              _mobiliteField(),
            ]),
            const SizedBox(height: 16),
            _section('MÉDICAL', Icons.medical_information_outlined, null, [
              _field('Médecin', _medecin, icon: Icons.medical_services_outlined),
              _field('Mutuelle', _mutuelle, icon: Icons.health_and_safety_outlined),
            ]),
            const SizedBox(height: 16),
            _section('URGENCE', Icons.emergency_outlined, const Color(0xFFBA1A1A), [
              _field('Nom du contact', _urgNom, icon: Icons.person_outline),
              _field('Téléphone urgence', _urgTel, keyboardType: TextInputType.phone, icon: Icons.phone_in_talk_outlined),
            ]),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, IconData icon, Color? headerColor, List<Widget> children) {
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
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Row(
              children: [
                Icon(icon, size: 18, color: headerColor ?? AppTheme.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: headerColor ?? AppTheme.secondary,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType? keyboardType, IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: icon != null ? Icon(icon, size: 20, color: AppTheme.secondary) : null,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade200),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
          ),
          filled: true,
          fillColor: const Color(0xFFF9FAFB),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        ),
      ),
    );
  }

  Widget _mobiliteField() {
    const options = <Map<String, Object>>[
      {'value': 'ASSIS',            'label': 'Marche seul',      'icon': Icons.directions_walk},
      {'value': 'FAUTEUIL_ROULANT', 'label': 'Fauteuil roulant', 'icon': Icons.accessible},
      {'value': 'ALLONGE',          'label': 'Allongé / Civière', 'icon': Icons.airline_seat_flat},
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mobilité',
              style: TextStyle(fontSize: 12, color: AppTheme.secondary, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Row(
            children: options.map((opt) {
              final selected = _mobilite == opt['value'];
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _mobilite = opt['value'] as String),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected ? AppTheme.primary : Colors.grey.shade200,
                        width: selected ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(opt['icon'] as IconData,
                            size: 20, color: selected ? AppTheme.primary : Colors.grey),
                        const SizedBox(height: 4),
                        Text(
                          opt['label'] as String,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: selected ? AppTheme.primary : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
