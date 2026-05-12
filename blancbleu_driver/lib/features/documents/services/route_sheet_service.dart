import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

class RouteSheetService {
  static Future<void> shareRouteSheet({
    required Map<String, dynamic> shift,
    required List<Map<String, dynamic>> transports,
    required Map<String, dynamic> user,
  }) async {
    final doc = pw.Document();

    final vehicleInfo = shift['vehicleId'];
    final plate = vehicleInfo is Map ? vehicleInfo['immatriculation']?.toString() ?? '—' : '—';
    final vehicleType = vehicleInfo is Map ? vehicleInfo['type']?.toString() ?? '' : '';

    final driverName = '${user['prenom'] ?? ''} ${user['nom'] ?? ''}'.trim();

    final rawStart = shift['startTime'];
    final rawEnd   = shift['endTime'];
    String startStr = '—';
    String endStr   = '—';
    String durStr   = '';
    if (rawStart != null) {
      try {
        final dt = DateTime.parse(rawStart.toString()).toLocal();
        startStr = _fmtTime(dt);
        if (rawEnd != null) {
          final dtEnd = DateTime.parse(rawEnd.toString()).toLocal();
          endStr = _fmtTime(dtEnd);
          final diff = dtEnd.difference(dt);
          final h = diff.inHours;
          final m = diff.inMinutes % 60;
          durStr = '${h}h${m.toString().padLeft(2, '0')}';
        }
      } catch (_) {}
    }

    final dateStr = rawStart != null
      ? _fmtDate(DateTime.tryParse(rawStart.toString())?.toLocal() ?? DateTime.now())
      : _fmtDate(DateTime.now());

    final totalKm     = shift['totalKm'] ?? 0;
    final totalCount  = transports.length;
    final doneCount   = transports.where((t) => ['COMPLETED', 'BILLED'].contains(t['statut'])).length;

    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (_) => _buildHeader(driverName, plate, vehicleType, dateStr, startStr, endStr, durStr),
      footer: (ctx) => pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text('BlancBleu Transport — Feuille de route', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey)),
          pw.Text('Page ${ctx.pageNumber} / ${ctx.pagesCount}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey)),
        ],
      ),
      build: (_) => [
        pw.SizedBox(height: 16),
        _buildStats(totalCount, doneCount, totalKm),
        pw.SizedBox(height: 16),
        _buildTransportTable(transports),
        pw.SizedBox(height: 32),
        _buildSignatureLine(),
      ],
    ));

    await Printing.sharePdf(bytes: await doc.save(), filename: 'feuille_route_$dateStr.pdf');
  }

  static pw.Widget _buildHeader(String driver, String plate, String type, String date,
      String start, String end, String dur) {
    return pw.Container(
      padding: const pw.EdgeInsets.only(bottom: 16),
      decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300))),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('AMBULANCES BLANC BLEU',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: PdfColors.teal700)),
            pw.Text('59 Bd Madeleine — Nice', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
          ]),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('FEUILLE DE ROUTE', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
            pw.Text(date, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
          ]),
        ]),
        pw.SizedBox(height: 12),
        pw.Row(children: [
          _infoBox('Chauffeur', driver),
          pw.SizedBox(width: 16),
          _infoBox('Véhicule', plate + (type.isNotEmpty ? ' · $type' : '')),
          pw.SizedBox(width: 16),
          _infoBox('Shift', dur.isNotEmpty ? '$start → $end ($dur)' : '$start → —'),
        ]),
      ]),
    );
  }

  static pw.Widget _infoBox(String label, String value) => pw.Expanded(
    child: pw.Container(
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(color: PdfColors.grey100, borderRadius: pw.BorderRadius.circular(4)),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
        pw.SizedBox(height: 2),
        pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
      ]),
    ),
  );

  static pw.Widget _buildStats(int total, int done, int km) => pw.Row(children: [
    _statChip('$total', 'transports'),
    pw.SizedBox(width: 12),
    _statChip('$done', 'complétés'),
    pw.SizedBox(width: 12),
    _statChip('$km km', 'parcourus'),
  ]);

  static pw.Widget _statChip(String val, String label) => pw.Container(
    padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: pw.BoxDecoration(
      border: pw.Border.all(color: PdfColors.teal300),
      borderRadius: pw.BorderRadius.circular(4),
    ),
    child: pw.Row(children: [
      pw.Text(val, style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: PdfColors.teal700)),
      pw.SizedBox(width: 4),
      pw.Text(label, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600)),
    ]),
  );

  static pw.Widget _buildTransportTable(List<Map<String, dynamic>> transports) {
    final headers = ['Heure', 'Patient', 'Départ', 'Destination', 'Type', '✓'];
    final rows = transports.map((t) {
      final patient   = t['patient'] as Map? ?? {};
      final nom       = '${(patient['prenom'] as String? ?? '')[0]}. ${patient['nom'] ?? ''}'.trim();
      final heure     = (t['heureRDV'] as String? ?? '--:--').substring(0, 5);
      final dep       = _fmtAddr(t['adresseDepart']);
      final dst       = _fmtAddr(t['adresseDestination']);
      final type      = t['typeTransport'] as String? ?? '—';
      final done      = ['COMPLETED', 'BILLED'].contains(t['statut']) ? '✓' : '';
      return [heure, nom, dep, dst, type, done];
    }).toList();

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey200, width: 0.5),
      columnWidths: {
        0: const pw.FixedColumnWidth(42),
        1: const pw.FixedColumnWidth(70),
        2: const pw.FlexColumnWidth(2),
        3: const pw.FlexColumnWidth(2),
        4: const pw.FixedColumnWidth(52),
        5: const pw.FixedColumnWidth(20),
      },
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: PdfColors.teal700),
          children: headers.map((h) => pw.Padding(
            padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
            child: pw.Text(h, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
          )).toList(),
        ),
        ...rows.asMap().entries.map((entry) {
          final isOdd = entry.key.isOdd;
          return pw.TableRow(
            decoration: pw.BoxDecoration(color: isOdd ? PdfColors.grey50 : PdfColors.white),
            children: entry.value.map((cell) => pw.Padding(
              padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: pw.Text(cell, style: const pw.TextStyle(fontSize: 9)),
            )).toList(),
          );
        }),
      ],
    );
  }

  static pw.Widget _buildSignatureLine() => pw.Row(
    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
    children: [
      pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('Signature du chauffeur :', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600)),
        pw.SizedBox(height: 40),
        pw.Container(width: 160, height: 1, color: PdfColors.grey400),
      ]),
      pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Text('Visa dispatcher :', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600)),
        pw.SizedBox(height: 40),
        pw.Container(width: 160, height: 1, color: PdfColors.grey400),
      ]),
    ],
  );

  static String _fmtTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

  static String _fmtDate(DateTime dt) =>
    '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';

  static String _fmtAddr(dynamic a) {
    if (a == null) return '—';
    if (a is String) return a;
    final m = a as Map;
    return [m['nom'], m['ville']].where((s) => s != null && s.toString().isNotEmpty).join(', ');
  }
}
