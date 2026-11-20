import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> tipo(int id, String nombre, {int? dias = 180, int? km = 5000, bool activo = true}) =>
    {'id': id, 'name': nombre, 'intervalDays': dias, 'intervalKm': km, 'active': activo};

Map<String, dynamic> configuracion() => {
      'workshop': {'name': 'Taller', 'address': 'Dirección', 'phone': '55 0000 0000', 'source': 'default'},
      'maintenance': {'soonDays': 30, 'soonKm': 1000, 'source': 'default'},
      'updatedAt': null,
      'updatedByName': null,
    };

/// Servidor falso con un catálogo en memoria: GET, POST, PUT y PATCH de /service-types.
class CatalogoFalso {
  CatalogoFalso(List<Map<String, dynamic>> inicial) : tipos = [...inicial];

  final List<Map<String, dynamic>> tipos;
  FakeResponse Function(http.Request)? alGuardar;

  FakeResponse responder(http.Request request) {
    final ruta = request.url.path;
    if (ruta.endsWith('/service-types') && request.method == 'GET') {
      return FakeResponse(200, {'data': tipos});
    }
    if (alGuardar != null && request.method != 'GET') {
      return alGuardar!(request);
    }
    return FakeResponse(200, {'data': tipos.first});
  }
}

Future<List<http.Request>> abrirConfiguracion(
  WidgetTester tester,
  CatalogoFalso catalogo, {
  Future<void>? Function(http.Request request)? hold,
  bool esperar = true,
}) async {
  tester.view.physicalSize = const Size(2000, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi((request) {
    final ruta = request.url.path;
    if (ruta.endsWith('/auth/login')) {
      return FakeResponse(200, {
        'data': {'token': 't', 'expiresIn': 28800, 'user': userJson(), 'termsAccepted': true},
      });
    }
    if (ruta.endsWith('/notifications/count')) {
      return FakeResponse(200, {'data': {'unread': 0}});
    }
    if (ruta.endsWith('/terms/current')) {
      return FakeResponse(200, {'data': null});
    }
    if (ruta.endsWith('/settings')) {
      return FakeResponse(200, {'data': configuracion()});
    }
    if (ruta.contains('/service-types')) {
      return catalogo.responder(request);
    }
    return listaVacia();
  }, log: log, hold: hold);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Configuración').first);
  // Con una respuesta retenida no se puede esperar a que todo se asiente: el tiempo simulado vencería la petición.
  if (esperar) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }
  return log;
}

// Los iconos de la tabla pueden quedar debajo del borde visible: se desplaza hasta ellos antes de tocar.
Future<void> tocar(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

List<http.Request> envios(List<http.Request> log, String metodo) =>
    log.where((r) => r.method == metodo && r.url.path.contains('/service-types')).toList();

void main() {
  group('catálogo', () {
    testWidgets('lista los tipos con su intervalo y su estado', (tester) async {
      await abrirConfiguracion(
        tester,
        CatalogoFalso([tipo(1, 'Cambio de aceite'), tipo(2, 'Alineación', dias: 365, km: null), tipo(3, 'Batería', activo: false)]),
      );

      expect(find.text('Tipos de servicio'), findsOneWidget);
      expect(find.text('Cambio de aceite'), findsOneWidget);
      expect(find.text('Alineación'), findsOneWidget);
      expect(find.text('Batería'), findsOneWidget);
      expect(find.text('180 días'), findsNWidgets(2), reason: 'el aceite y la batería se repiten cada 180 días');
      expect(find.text('5,000 km'), findsNWidgets(2));
      expect(find.text('Inactivo'), findsOneWidget);
    });

    testWidgets('un tipo sin uno de los intervalos muestra un guion en esa columna', (tester) async {
      await abrirConfiguracion(tester, CatalogoFalso([tipo(2, 'Alineación', dias: 365, km: null)]));
      expect(find.text('365 días'), findsOneWidget);
      expect(find.text('—'), findsOneWidget);
    });

    testWidgets('sin tipos muestra un mensaje de vacío', (tester) async {
      await abrirConfiguracion(tester, CatalogoFalso([]));
      expect(find.textContaining('Todavía no hay tipos de servicio'), findsOneWidget);
    });

    testWidgets('muestra el estado de carga mientras llega el catálogo', (tester) async {
      final espera = Completer<void>();
      tester.view.physicalSize = const Size(2000, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final catalogo = CatalogoFalso([tipo(1, 'Cambio de aceite')]);
      await abrirConfiguracion(
        tester,
        catalogo,
        hold: (r) => r.url.path.contains('/service-types') && r.method == 'GET' ? espera.future : null,
        esperar: false,
      );
      expect(find.text('Cambio de aceite'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsWidgets);

      espera.complete();
      await tester.pumpAndSettle();
      expect(find.text('Cambio de aceite'), findsOneWidget);
    });

    testWidgets('con un error del servidor muestra el mensaje y permite reintentar', (tester) async {
      var falla = true;
      final catalogo = CatalogoFalso([tipo(1, 'Cambio de aceite')]);
      await abrirConfiguracion(
        tester,
        _CatalogoQueFalla(catalogo, () => falla),
      );
      expect(find.text('No se pudo cargar el catálogo.'), findsOneWidget);

      falla = false;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Cambio de aceite'), findsOneWidget);
    });
  });

  group('alta y edición', () {
    testWidgets('crea un tipo con nombre e intervalos y lo envía al servidor', (tester) async {
      final catalogo = CatalogoFalso([tipo(1, 'Frenos', dias: null, km: 20000)]);
      final log = await abrirConfiguracion(tester, catalogo);

      await tester.tap(find.text('Agregar tipo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'Cambio de aceite');
      await tester.enterText(find.widgetWithText(TextFormField, 'Intervalo en días (opcional)'), '180');
      await tester.enterText(find.widgetWithText(TextFormField, 'Intervalo en kilómetros (opcional)'), '5000');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final posts = envios(log, 'POST');
      expect(posts, hasLength(1));
      expect(posts.single.body, contains('"name":"Cambio de aceite"'));
      expect(posts.single.body, contains('"intervalDays":180'));
      expect(posts.single.body, contains('"intervalKm":5000'));
      expect(find.text('Tipo de servicio guardado.'), findsOneWidget);
    });

    testWidgets('valida en el formulario: nombre vacío, sin intervalos y valores fuera de rango, sin enviar nada', (tester) async {
      final log = await abrirConfiguracion(tester, CatalogoFalso([tipo(1, 'Frenos')]));

      await tester.tap(find.text('Agregar tipo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('El nombre es obligatorio.'), findsOneWidget);
      expect(find.text('Indica al menos un intervalo: en días, en kilómetros o en ambos.'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'X');
      await tester.enterText(find.widgetWithText(TextFormField, 'Intervalo en días (opcional)'), '4000');
      await tester.enterText(find.widgetWithText(TextFormField, 'Intervalo en kilómetros (opcional)'), '600000');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('Los días deben ser un entero entre 1 y 3,650.'), findsOneWidget);
      expect(find.text('Los kilómetros deben ser un entero entre 1 y 500,000.'), findsOneWidget);
      expect(envios(log, 'POST'), isEmpty);
    });

    testWidgets('un nombre repetido muestra el error del servidor bajo el campo y no cierra el formulario', (tester) async {
      final catalogo = CatalogoFalso([tipo(1, 'Frenos')])
        ..alGuardar = (_) => apiError(409, 'SERVICE_TYPE_DUPLICATE', 'Ya existe un tipo de servicio con ese nombre.');
      await abrirConfiguracion(tester, catalogo);

      await tester.tap(find.text('Agregar tipo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'frenos');
      await tester.enterText(find.widgetWithText(TextFormField, 'Intervalo en días (opcional)'), '30');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Ya existe un tipo de servicio con ese nombre.'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Nombre'), findsOneWidget, reason: 'el formulario sigue abierto');
    });

    testWidgets('edita un tipo: el formulario trae sus datos y se envía un PUT', (tester) async {
      final catalogo = CatalogoFalso([tipo(1, 'Cambio de aceite')]);
      final log = await abrirConfiguracion(tester, catalogo);

      await tocar(tester, find.byTooltip('Editar Cambio de aceite'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextFormField, 'Cambio de aceite'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextFormField, 'Cambio de aceite'), 'Cambio de aceite sintético');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final puts = envios(log, 'PUT');
      expect(puts, hasLength(1));
      expect(puts.single.url.path, endsWith('/service-types/1'));
      expect(puts.single.body, contains('Cambio de aceite sintético'));
    });
  });

  group('activar y desactivar', () {
    testWidgets('desactivar pide confirmación y envía el cambio de estado', (tester) async {
      final catalogo = CatalogoFalso([tipo(1, 'Cambio de aceite')]);
      final log = await abrirConfiguracion(tester, catalogo);

      await tocar(tester, find.byTooltip('Desactivar Cambio de aceite'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Seguro que quieres desactivar'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      final patches = envios(log, 'PATCH');
      expect(patches, hasLength(1));
      expect(patches.single.url.path, endsWith('/service-types/1/status'));
      expect(patches.single.body, contains('"active":false'));
    });

    testWidgets('cancelar la confirmación no envía nada', (tester) async {
      final log = await abrirConfiguracion(tester, CatalogoFalso([tipo(1, 'Cambio de aceite')]));

      await tocar(tester, find.byTooltip('Desactivar Cambio de aceite'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();

      expect(envios(log, 'PATCH'), isEmpty);
    });

    testWidgets('un tipo inactivo se reactiva sin confirmación y no ofrece borrar', (tester) async {
      final log = await abrirConfiguracion(tester, CatalogoFalso([tipo(3, 'Batería', activo: false)]));

      expect(find.byTooltip('Eliminar Batería'), findsNothing);
      await tocar(tester, find.byTooltip('Reactivar Batería'));
      await tester.pumpAndSettle();

      expect(envios(log, 'PATCH').single.body, contains('"active":true'));
    });
  });
}

/// Catálogo cuyo GET falla mientras `falla()` sea verdadero.
class _CatalogoQueFalla extends CatalogoFalso {
  _CatalogoQueFalla(CatalogoFalso base, this.falla) : super(base.tipos);

  final bool Function() falla;

  @override
  FakeResponse responder(http.Request request) {
    if (request.method == 'GET' && falla()) {
      return apiError(500, 'INTERNAL_ERROR', 'No se pudo cargar el catálogo.');
    }
    return super.responder(request);
  }
}
