// Guardado de reportes exportados. La implementación depende de la plataforma: en escritorio se escribe en la carpeta de
// Descargas y en la web se entrega al navegador para que lo descargue.
export 'report_saver_base.dart';
export 'report_saver_io.dart' if (dart.library.js_interop) 'report_saver_web.dart';
