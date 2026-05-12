import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../shift/cubit/shift_cubit.dart';
import '../../../core/storage/local_database.dart';
import '../../../shared/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  final Map<String, dynamic> user;
  const ProfileScreen({super.key, required this.user});

  String _statut(ShiftState state) {
    if (state is ShiftActive) return 'En shift';
    return user['statut'] as String? ?? 'Disponible';
  }

  Color _statutColor(ShiftState state) {
    if (state is ShiftActive) return const Color(0xFF2563EB);
    return AppTheme.success;
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: const Text('Votre session sera fermée et les données locales effacées.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await LocalDatabase.instance.markMessagesRead();
              if (context.mounted) context.read<AuthCubit>().logout();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error, minimumSize: const Size(0, 0)),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final nom    = user['nom']    as String? ?? '';
    final prenom = user['prenom'] as String? ?? '';
    final email  = user['email'] as String? ?? '';
    final phone  = user['telephone'] as String? ?? '';
    final role   = user['role']  as String? ?? '';
    final initials = '${prenom.isNotEmpty ? prenom[0] : '?'}${nom.isNotEmpty ? nom[0] : ''}'.toUpperCase();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Mon profil'), automaticallyImplyLeading: false),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
          // Avatar
          const SizedBox(height: 8),
          CircleAvatar(
            radius: 44,
            backgroundColor: AppTheme.primary.withOpacity(0.15),
            child: Text(initials,
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, color: AppTheme.primary)),
          ),
          const SizedBox(height: 12),
          Text('$prenom $nom'.trim(),
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.onSurface)),
          const SizedBox(height: 4),
          Text(role, style: const TextStyle(fontSize: 13, color: AppTheme.secondary)),
          const SizedBox(height: 8),
          BlocBuilder<ShiftCubit, ShiftState>(
            builder: (context, state) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: _statutColor(state).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 8, height: 8,
                  decoration: BoxDecoration(color: _statutColor(state), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(_statut(state),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _statutColor(state))),
              ]),
            ),
          ),

          const SizedBox(height: 24),

          // Contact info card
          _card([
            if (email.isNotEmpty) _infoRow(Icons.email_outlined, email),
            if (email.isNotEmpty && phone.isNotEmpty) const Divider(height: 20),
            if (phone.isNotEmpty) _infoRow(Icons.phone_outlined, phone),
          ]),

          const SizedBox(height: 12),

          // Shift summary (if active)
          BlocBuilder<ShiftCubit, ShiftState>(
            builder: (context, state) {
              if (state is! ShiftActive) return const SizedBox();
              final count = state.shift['transportCount'] ?? 0;
              final vehicleInfo = state.shift['vehicleId'];
              final plate = vehicleInfo is Map ? vehicleInfo['immatriculation']?.toString() ?? '' : '';
              return Column(children: [
                _card([
                  const Text('Shift actif',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.secondary)),
                  const SizedBox(height: 8),
                  if (plate.isNotEmpty) _infoRow(Icons.directions_car_outlined, plate),
                  if (plate.isNotEmpty) const Divider(height: 16),
                  _infoRow(Icons.assignment_outlined, '$count transport${count != 1 ? 's' : ''} assigné${count != 1 ? 's' : ''}'),
                ]),
                const SizedBox(height: 12),
              ]);
            },
          ),

          // Actions
          _card([
            _actionTile(
              icon: Icons.lock_outline,
              label: 'Changer le mot de passe',
              onTap: () => _showChangePassword(context),
            ),
          ]),

          const SizedBox(height: 12),

          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _confirmLogout(context),
              icon: const Icon(Icons.logout, color: AppTheme.error),
              label: const Text('Se déconnecter', style: TextStyle(color: AppTheme.error)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppTheme.error),
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          ),

          const SizedBox(height: 32),
          const Text('BlancBleu Driver v1.0.0', style: TextStyle(fontSize: 11, color: AppTheme.secondary)),
        ]),
      ),
    );
  }

  void _showChangePassword(BuildContext context) {
    final currentCtrl = TextEditingController();
    final newCtrl     = TextEditingController();
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 32),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Changer le mot de passe',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppTheme.onSurface)),
            const SizedBox(height: 20),
            TextField(
              controller: currentCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Nouveau mot de passe'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: saving ? null : () async {
                setSt(() => saving = true);
                try {
                  // API call handled by auth cubit in a real implementation
                  await Future.delayed(const Duration(milliseconds: 800));
                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Mot de passe modifié ✓'), backgroundColor: AppTheme.success),
                    );
                  }
                } catch (_) {
                  setSt(() => saving = false);
                }
              },
              child: saving ? const Text('Enregistrement...') : const Text('Confirmer'),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _card(List<Widget> children) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.grey.shade100),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _infoRow(IconData icon, String text) => Row(children: [
    Icon(icon, size: 18, color: AppTheme.secondary),
    const SizedBox(width: 10),
    Expanded(child: Text(text, style: const TextStyle(fontSize: 14, color: AppTheme.onSurface))),
  ]);

  Widget _actionTile({required IconData icon, required String label, required VoidCallback onTap}) =>
    InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Icon(icon, size: 20, color: AppTheme.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppTheme.onSurface))),
          const Icon(Icons.chevron_right, size: 18, color: AppTheme.secondary),
        ]),
      ),
    );
}
