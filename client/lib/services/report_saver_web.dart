import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import 'report_saver_base.dart';

/// El guardador de esta plataforma.
ReportSaver createReportSaver() => const BrowserReportSaver();

/// Entrega el archivo al navegador, que lo descarga en la carpeta de Descargas de la persona.
class BrowserReportSaver implements ReportSaver {
  const BrowserReportSaver();

  @override
  Future<String> save({required String fileName, required List<int> bytes}) async {
    try {
      final blob = web.Blob(
        [Uint8List.fromList(bytes).toJS].toJS,
        web.BlobPropertyBag(type: 'text/csv;charset=utf-8'),
      );
      final url = web.URL.createObjectURL(blob);
      final link = web.HTMLAnchorElement()
        ..href = url
        ..download = fileName;
      web.document.body!.append(link);
      link.click();
      link.remove();
      web.URL.revokeObjectURL(url);
      return fileName;
    } catch (_) {
      throw const ReportSaveException('El navegador no permitió descargar el archivo.');
    }
  }
}
