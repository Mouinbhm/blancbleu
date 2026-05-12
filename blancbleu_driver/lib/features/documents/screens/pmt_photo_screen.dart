import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/theme/app_theme.dart';

class PmtPhotoScreen extends StatefulWidget {
  final String transportId;
  const PmtPhotoScreen({super.key, required this.transportId});
  @override
  State<PmtPhotoScreen> createState() => _PmtPhotoScreenState();
}

class _PmtPhotoScreenState extends State<PmtPhotoScreen> {
  File? _photo;
  bool  _uploading = false;

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (picked != null && mounted) setState(() => _photo = File(picked.path));
  }

  Future<void> _confirm() async {
    if (_photo == null) return;
    setState(() => _uploading = true);
    try {
      await ApiClient.instance.uploadPmtPhoto(widget.transportId, _photo!.path);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo PMT enregistrée'), backgroundColor: AppTheme.success));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.error));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Photo PMT')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Expanded(
              child: _photo == null
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.camera_alt_outlined, size: 64, color: AppTheme.secondary),
                          const SizedBox(height: 16),
                          const Text('Aucune photo prise', style: TextStyle(color: AppTheme.secondary)),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(onPressed: _takePhoto, icon: const Icon(Icons.camera_alt), label: const Text('Prendre une photo')),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(_photo!, fit: BoxFit.contain))),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: OutlinedButton.icon(onPressed: _takePhoto, icon: const Icon(Icons.refresh), label: const Text('Reprendre'))),
                            const SizedBox(width: 12),
                            Expanded(child: ElevatedButton.icon(onPressed: _uploading ? null : _confirm, icon: const Icon(Icons.check), label: Text(_uploading ? 'Envoi...' : 'Confirmer'))),
                          ],
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
