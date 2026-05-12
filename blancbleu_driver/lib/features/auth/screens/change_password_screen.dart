import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/auth_cubit.dart';
import '../../../shared/theme/app_theme.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _ancienCtrl    = TextEditingController();
  final _nouveauCtrl   = TextEditingController();
  final _confirmCtrl   = TextEditingController();
  bool _obscureAncien  = true;
  bool _obscureNouveau = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _ancienCtrl.dispose();
    _nouveauCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final ancien  = _ancienCtrl.text.trim();
    final nouveau = _nouveauCtrl.text.trim();
    final confirm = _confirmCtrl.text.trim();

    if (ancien.isEmpty || nouveau.isEmpty || confirm.isEmpty) {
      _showError('Tous les champs sont obligatoires');
      return;
    }
    if (nouveau.length < 8) {
      _showError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (nouveau != confirm) {
      _showError('Les mots de passe ne correspondent pas');
      return;
    }
    context.read<AuthCubit>().changePassword(ancien, nouveau);
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppTheme.error),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: BlocListener<AuthCubit, AuthState>(
          listener: (context, state) {
            if (state is AuthError) _showError(state.message);
          },
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(16)),
                  child: const Icon(Icons.lock_reset_outlined, color: AppTheme.primary, size: 28),
                ),
                const SizedBox(height: 20),
                const Text('Modifier le mot de passe',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppTheme.onSurface)),
                const SizedBox(height: 6),
                Text('Votre compte requiert un nouveau mot de passe.',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                const SizedBox(height: 36),

                _passwordField(
                  controller: _ancienCtrl,
                  label: 'Mot de passe actuel',
                  obscure: _obscureAncien,
                  onToggle: () => setState(() => _obscureAncien = !_obscureAncien),
                ),
                const SizedBox(height: 16),
                _passwordField(
                  controller: _nouveauCtrl,
                  label: 'Nouveau mot de passe',
                  obscure: _obscureNouveau,
                  onToggle: () => setState(() => _obscureNouveau = !_obscureNouveau),
                ),
                const SizedBox(height: 16),
                _passwordField(
                  controller: _confirmCtrl,
                  label: 'Confirmer le mot de passe',
                  obscure: _obscureConfirm,
                  onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 32),

                BlocBuilder<AuthCubit, AuthState>(
                  builder: (context, state) {
                    final loading = state is AuthLoading;
                    return ElevatedButton.icon(
                      onPressed: loading ? null : _submit,
                      icon: loading
                          ? const SizedBox(width: 18, height: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.check),
                      label: Text(loading ? 'Enregistrement...' : 'Confirmer'),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _passwordField({
    required TextEditingController controller,
    required String label,
    required bool obscure,
    required VoidCallback onToggle,
    ValueChanged<String>? onSubmitted,
  }) =>
      TextField(
        controller: controller,
        obscureText: obscure,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.lock_outlined),
          suffixIcon: IconButton(
            icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            onPressed: onToggle,
          ),
        ),
      );
}
