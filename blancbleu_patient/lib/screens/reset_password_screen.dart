import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  bool _success = false;
  String? _errorMessage;

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _reset() async {
    final token = _tokenController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (token.isEmpty || password.isEmpty || confirm.isEmpty) {
      setState(() => _errorMessage = 'Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 8) {
      setState(() =>
          _errorMessage = 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password != confirm) {
      setState(() => _errorMessage = 'Les mots de passe ne correspondent pas.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ApiService.resetPassword(token, password);
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _success = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppTheme.primary),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: _success ? _buildSuccess() : _buildForm(),
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        const Icon(Icons.lock_outline, size: 56, color: AppTheme.primary),
        const SizedBox(height: 20),
        const Text(
          'Nouveau mot de passe',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: AppTheme.onSurface,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Copiez le token depuis le lien reçu par e-mail, '
          'puis choisissez votre nouveau mot de passe.',
          style: TextStyle(fontSize: 14, color: AppTheme.secondary, height: 1.5),
        ),
        const SizedBox(height: 32),

        _buildLabel('Token de réinitialisation'),
        const SizedBox(height: 8),
        TextField(
          controller: _tokenController,
          keyboardType: TextInputType.text,
          decoration: _inputDecoration(
            hint: 'Collez votre token ici',
            icon: Icons.vpn_key_outlined,
          ),
        ),

        const SizedBox(height: 20),
        _buildLabel('Nouveau mot de passe'),
        const SizedBox(height: 8),
        TextField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          decoration: _inputDecoration(
            hint: '••••••••',
            icon: _obscurePassword ? Icons.lock_outline : Icons.lock_open_outlined,
            onIconTap: () =>
                setState(() => _obscurePassword = !_obscurePassword),
          ),
        ),

        const SizedBox(height: 20),
        _buildLabel('Confirmer le mot de passe'),
        const SizedBox(height: 8),
        TextField(
          controller: _confirmController,
          obscureText: _obscureConfirm,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _reset(),
          decoration: _inputDecoration(
            hint: '••••••••',
            icon: _obscureConfirm ? Icons.lock_outline : Icons.lock_open_outlined,
            onIconTap: () =>
                setState(() => _obscureConfirm = !_obscureConfirm),
          ),
        ),

        if (_errorMessage != null) ...[
          const SizedBox(height: 14),
          _ErrorBanner(message: _errorMessage!),
        ],

        const SizedBox(height: 28),

        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _reset,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryContainer,
              foregroundColor: Colors.white,
              disabledBackgroundColor:
                  AppTheme.primaryContainer.withOpacity(0.6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 4,
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Text(
                    'Réinitialiser le mot de passe',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 40),
        const Center(
          child: Icon(
            Icons.check_circle_outline,
            size: 72,
            color: Color(0xFF22C55E),
          ),
        ),
        const SizedBox(height: 24),
        const Center(
          child: Text(
            'Mot de passe réinitialisé !',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurface,
            ),
          ),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            'Votre mot de passe a été mis à jour avec succès.\n'
            'Vous pouvez maintenant vous connecter.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: AppTheme.secondary, height: 1.6),
          ),
        ),
        const SizedBox(height: 40),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
              (_) => false,
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryContainer,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 4,
            ),
            child: const Text(
              'Se connecter',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text) => Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.onSurface,
        ),
      );

  InputDecoration _inputDecoration({
    required String hint,
    required IconData icon,
    VoidCallback? onIconTap,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: AppTheme.outlineVariant.withOpacity(0.8),
        fontSize: 14,
      ),
      suffixIcon: onIconTap != null
          ? IconButton(
              icon: Icon(icon, color: AppTheme.outlineVariant),
              onPressed: onIconTap,
            )
          : Icon(icon, color: AppTheme.outlineVariant),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppTheme.primary, width: 2),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
