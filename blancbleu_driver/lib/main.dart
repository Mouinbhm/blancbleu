import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/network/api_client.dart';
import 'core/network/sync_service.dart';
import 'core/notifications/notification_service.dart';
import 'core/theme/theme_notifier.dart';
import 'features/auth/cubit/auth_cubit.dart';
import 'features/tournee/cubit/tournee_cubit.dart';
import 'features/shift/cubit/shift_cubit.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/tournee/screens/home_screen.dart';
import 'services/gps_service.dart';
import 'shared/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR', null);
  try { await GpsService.init(); } catch (e) { debugPrint('[main] GpsService.init error: $e'); }
  try { await ThemeNotifier.instance.init(); } catch (e) { debugPrint('[main] ThemeNotifier.init error: $e'); }
  try { await NotificationService.init(); } catch (e) { debugPrint('[main] NotificationService.init error: $e'); }
  runApp(const BlancBleuDriverApp());
}

class BlancBleuDriverApp extends StatelessWidget {
  const BlancBleuDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => AuthCubit()..tryAutoLogin()),
        BlocProvider(create: (_) => TourneeCubit()),
        BlocProvider(create: (_) => ShiftCubit()),
      ],
      child: ListenableBuilder(
        listenable: ThemeNotifier.instance,
        builder: (_, __) => MaterialApp(
          title: 'BlancBleu Driver',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.theme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeNotifier.instance.mode,
          home: const _Root(),
        ),
      ),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();
  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  @override
  void initState() {
    super.initState();
    // When the server returns 401/403, auto-logout and go back to login
    ApiClient.onUnauthorized = () {
      if (!mounted) return;
      context.read<AuthCubit>().logout();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Session expirée — veuillez vous reconnecter.'),
        backgroundColor: Colors.red,
        duration: Duration(seconds: 4),
      ));
    };
  }

  @override
  void dispose() {
    ApiClient.onUnauthorized = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthCubit, AuthState>(
      listener: (context, state) {
        if (state is AuthSuccess) {
          // Reset the logout guard so the new session works normally
          ApiClient.instance.resetSession();
          SyncService.instance.sync();
        }
      },
      builder: (context, state) {
        if (state is AuthSuccess) return HomeScreen(user: state.user);
        if (state is AuthLoading) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return const LoginScreen();
      },
    );
  }
}
