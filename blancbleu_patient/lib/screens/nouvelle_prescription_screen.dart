import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../config/theme.dart';
import '../services/api_service.dart';

class NouvellePrescriptionScreen extends StatefulWidget {
  const NouvellePrescriptionScreen({super.key});

  @override
  State<NouvellePrescriptionScreen> createState() => _NouvellePrescriptionScreenState();
}

class _NouvellePrescriptionScreenState extends State<NouvellePrescriptionScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  static const _motifs = [
    'Dialyse',
    'Chimiothérapie',
    'Radiothérapie',
    'Consultation',
    'Hospitalisation',
    'Sortie hospitalisation',
    'Rééducation',
    'Analyse',
    'Autre',
  ];

  String _motif = 'Consultation';
  DateTime _dateEmission = DateTime.now();
  final _medecinNomCtrl    = TextEditingController();
  final _medecinPrenomCtrl = TextEditingController();
  final _medecinTelCtrl    = TextEditingController();
  final _etabCtrl          = TextEditingController();
  final _notesCtrl         = TextEditingController();

  File? _fichier;
  String? _fichierNom;

  @override
  void dispose() {
    _medecinNomCtrl.dispose();
    _medecinPrenomCtrl.dispose();
    _medecinTelCtrl.dispose();
    _etabCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      allowMultiple: false,
    );
    if (result != null && result.files.single.path != null) {
      setState(() {
        _fichier = File(result.files.single.path!);
        _fichierNom = result.files.single.name;
      });
    }
  }

  void _removeFile() => setState(() { _fichier = null; _fichierNom = null; });

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateEmission,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppTheme.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _dateEmission = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ApiService.createPrescription(
        {
          'motif': _motif,
          'dateEmission': _dateEmission.toIso8601String(),
          'medecin': {
            'nom':       _medecinNomCtrl.text.trim().toUpperCase(),
            'prenom':    _medecinPrenomCtrl.text.trim(),
            'telephone': _medecinTelCtrl.text.trim(),
          },
          'etablissementDestination': _etabCtrl.text.trim(),
          'notes': _notesCtrl.text.trim(),
        },
        fichier: _fichier,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ordonnance envoyée — en attente de validation'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _fmtDate(DateTime d) {
    const mois = ['janvier','février','mars','avril','mai','juin',
                  'juillet','août','septembre','octobre','novembre','décembre'];
    return '${d.day} ${mois[d.month - 1]} ${d.year}';
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
          'Nouvelle ordonnance',
          style: TextStyle(color: AppTheme.onSurface, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppTheme.onSurface, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          children: [
            // Info banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: AppTheme.primary, size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Saisissez les informations de votre prescription médicale. Elle sera validée par votre transporteur avant activation.',
                      style: TextStyle(fontSize: 12, color: AppTheme.primary, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Motif ──────────────────────────────────────────────────────────
            _sectionTitle('Motif du transport'),
            const SizedBox(height: 10),
            _card(
              child: DropdownButtonFormField<String>(
                value: _motif,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  prefixIcon: Icon(Icons.medical_services_outlined, color: AppTheme.primary, size: 20),
                  contentPadding: EdgeInsets.symmetric(vertical: 4),
                ),
                items: _motifs
                    .map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 14))))
                    .toList(),
                onChanged: (v) => setState(() => _motif = v!),
                validator: (v) => v == null || v.isEmpty ? 'Champ requis' : null,
              ),
            ),

            const SizedBox(height: 20),

            // ── Date d'émission ────────────────────────────────────────────────
            _sectionTitle("Date d'émission"),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _pickDate,
              child: _card(
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, color: AppTheme.primary, size: 20),
                    const SizedBox(width: 14),
                    Text(
                      _fmtDate(_dateEmission),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
                    ),
                    const Spacer(),
                    const Icon(Icons.chevron_right, color: AppTheme.secondary, size: 20),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // ── Médecin ────────────────────────────────────────────────────────
            _sectionTitle('Médecin prescripteur'),
            const SizedBox(height: 10),
            _card(
              child: Column(
                children: [
                  _field(_medecinPrenomCtrl, 'Prénom du médecin', Icons.person_outline),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  _field(_medecinNomCtrl, 'Nom du médecin', Icons.badge_outlined),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  _field(_medecinTelCtrl, 'Téléphone (optionnel)', Icons.phone_outlined, required: false, keyboard: TextInputType.phone),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Établissement ──────────────────────────────────────────────────
            _sectionTitle('Établissement de destination'),
            const SizedBox(height: 10),
            _card(
              child: _field(_etabCtrl, 'Hôpital, clinique… (optionnel)', Icons.local_hospital_outlined, required: false),
            ),

            const SizedBox(height: 20),

            // ── Notes ──────────────────────────────────────────────────────────
            _sectionTitle('Notes complémentaires'),
            const SizedBox(height: 10),
            _card(
              child: TextFormField(
                controller: _notesCtrl,
                maxLines: 3,
                style: const TextStyle(fontSize: 14),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  hintText: 'Informations supplémentaires…',
                  hintStyle: TextStyle(color: AppTheme.secondary, fontSize: 13),
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 48),
                    child: Icon(Icons.notes_outlined, color: AppTheme.primary, size: 20),
                  ),
                  contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // ── Document joint ─────────────────────────────────────────────────
            _sectionTitle('Document (optionnel)'),
            const SizedBox(height: 10),
            _fichier == null
                ? GestureDetector(
                    onTap: _pickFile,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFFBFDBFE),
                          style: BorderStyle.solid,
                          width: 1.5,
                        ),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.upload_file_outlined, color: AppTheme.primary, size: 32),
                          SizedBox(height: 8),
                          Text(
                            'Joindre la prescription',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.primary),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'PDF, JPG ou PNG — 10 Mo max',
                            style: TextStyle(fontSize: 11, color: AppTheme.secondary),
                          ),
                        ],
                      ),
                    ),
                  )
                : _card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              _fichierNom!.endsWith('.pdf')
                                  ? Icons.picture_as_pdf
                                  : Icons.image_outlined,
                              color: AppTheme.primary,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _fichierNom!,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${(_fichier!.lengthSync() / 1024).toStringAsFixed(0)} Ko',
                                  style: const TextStyle(fontSize: 11, color: AppTheme.secondary),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: _removeFile,
                            icon: const Icon(Icons.close, color: Colors.red, size: 20),
                            tooltip: 'Supprimer',
                          ),
                        ],
                      ),
                    ),
                  ),

            const SizedBox(height: 32),

            // ── Submit ─────────────────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 2,
                  shadowColor: AppTheme.primary.withOpacity(0.3),
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text('Envoyer l\'ordonnance',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
    text,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
        color: AppTheme.secondary, letterSpacing: 0.3),
  );

  Widget _card({required Widget child}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.grey.shade100),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
    ),
    child: child,
  );

  Widget _field(
    TextEditingController ctrl,
    String hint,
    IconData icon, {
    bool required = true,
    TextInputType keyboard = TextInputType.text,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: keyboard,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        border: InputBorder.none,
        hintText: hint,
        hintStyle: const TextStyle(color: AppTheme.secondary, fontSize: 13),
        prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
      ),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null
          : null,
    );
  }
}
