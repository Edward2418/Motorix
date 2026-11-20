import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> configuracion({
  String nombre = 'Taller Motorix (ejemplo)',
  String direccion = 'Av. Principal 123, Ciudad de México',
  String telefono = '55 0000 0000',
  String origenTaller = 'default',
  int dias = 30,
  int km = 1000,
  String origenMargenes = 'default',
  String? actualizadoPor,
}) =>
    {
      'workshop': {'name': nombre, 'address': direccion, 'phone': telefono, 'source': origenTaller},
      'maintenance': {'soonDays': dias, 'soonKm': km, 'source': origenMargenes},
      'updatedAt': actualizadoPor == null ? null : '2026-11-20T10:00:00.000Z',
      'updatedByName': actualizadoPor,
    };

FakeResponse respuesta(Map<String, dynamic> data) => FakeResponse(200, {'data': data});

Future<List<http.Request>> abrirConfiguracion(
  WidgetTester tester, {
  String role = 'ADMIN',
  required FakeHandler handler,
  bool abrirPantalla = true,
  Future<void>? Function(http.Request request)? hold,
}) async {
  tester.view.physicalSize = const Size(2000, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    if (request.url.path.endsWith('/notifications/count')) {
      return FakeResponse(200, {
        'data': {'unread': 0},
      });
    }
    return handler(request);
  }, log: log, hold: hold);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (abrirPantalla) {
    await tester.tap(find.text('Configuración').first);
    await tester.pumpAndSettle();
  }
  return log;
}

FakeHandler servidor(Map<String, dynamic> inicial, {FakeResponse Function(http.Request)? alGuardar}) => (request) {
      if (request.url.path.endsWith('/settings')) {
        if (request.method == 'PUT') {
          return alGuardar != null ? alGuardar(request) : respuesta(inicial);
        }
        return respuesta(inicial);
      }
      return listaVacia();
    };

void main() {
  group('datos del taller', () {
    testWidgets('carga los datos vigentes y avisa que aún vienen de los valores iniciales del servidor', (tester) async {
      await abrirConfiguracion(tester, handler: servidor(configuracion()));

      expect(find.text('Datos del taller'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Taller Motorix (ejemplo)'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Av. Principal 123, Ciudad de México'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '55 0000 0000'), findsOneWidget);
      expect(find.textContaining('valores iniciales del servidor'), findsOneWidget);
    });

    testWidgets('editar y guardar envía los datos, confirma con un mensaje y pasa a «guardado desde la aplicación»', (tester) async {
      final guardado = configuracion(
        nombre: 'Taller Los Pinos',
        origenTaller: 'saved',
        actualizadoPor: 'Administrador Motorix',
      );
      final log = await abrirConfiguracion(
        tester,
        handler: servidor(configuracion(), alGuardar: (_) => respuesta(guardado)),
      );

      await tester.enterText(find.widgetWithText(TextFormField, 'Taller Motorix (ejemplo)'), 'Taller Los Pinos');
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();

      final envios = log.where((r) => r.method == 'PUT' && r.url.path.endsWith('/settings')).toList();
      expect(envios, hasLength(1));
      expect(envios.single.body, contains('"workshop"'));
      expect(envios.single.body, contains('Taller Los Pinos'));
      expect(find.text('Datos del taller guardados.'), findsOneWidget);
      expect(find.textContaining('Guardado desde la aplicación'), findsOneWidget);
      expect(find.textContaining('Administrador Motorix'), findsOneWidget);
    });

    testWidgets('un nombre vacío muestra el error en el campo y no envía nada', (tester) async {
      final log = await abrirConfiguracion(tester, handler: servidor(configuracion()));

      await tester.enterText(find.widgetWithText(TextFormField, 'Taller Motorix (ejemplo)'), '');
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();

      expect(find.text('El nombre del taller es obligatorio.'), findsOneWidget);
      expect(log.where((r) => r.method == 'PUT'), isEmpty);
    });

    testWidgets('un nombre de más de 100 caracteres y un teléfono de más de 30 se rechazan en el campo', (tester) async {
      final log = await abrirConfiguracion(tester, handler: servidor(configuracion()));

      await tester.enterText(find.widgetWithText(TextFormField, 'Taller Motorix (ejemplo)'), 'a' * 101);
      await tester.enterText(find.widgetWithText(TextFormField, '55 0000 0000'), '5' * 31);
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();

      expect(find.text('El nombre del taller no puede pasar de 100 caracteres.'), findsOneWidget);
      expect(find.text('El teléfono del taller no puede pasar de 30 caracteres.'), findsOneWidget);
      expect(log.where((r) => r.method == 'PUT'), isEmpty);
    });

    testWidgets('si el servidor rechaza un dato muestra su mensaje bajo el campo', (tester) async {
      await abrirConfiguracion(
        tester,
        handler: servidor(
          configuracion(),
          alGuardar: (_) => apiError(400, 'VALIDATION_ERROR', 'Hay datos inválidos. Revisa los campos indicados.', details: [
            {'field': 'workshop.phone', 'message': 'El teléfono del taller es obligatorio.'},
          ]),
        ),
      );

      await tester.enterText(find.widgetWithText(TextFormField, 'Taller Motorix (ejemplo)'), 'Otro nombre');
      await tester.tap(find.text('Guardar cambios'));
      await tester.pumpAndSettle();

      expect(find.text('El teléfono del taller es obligatorio.'), findsOneWidget);
    });

    testWidgets('mientras consulta muestra un indicador de carga', (tester) async {
      final compuerta = Completer<void>();
      await abrirConfiguracion(
        tester,
        handler: servidor(configuracion()),
        abrirPantalla: false,
        hold: (request) => request.url.path.endsWith('/settings') ? compuerta.future : null,
      );
      await tester.tap(find.text('Configuración').first);
      // La pantalla pide los datos en un callback posterior al primer cuadro: el indicador aparece en el segundo.
      await tester.pump();
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsWidgets);

      compuerta.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('si la consulta falla muestra el error con la opción de reintentar', (tester) async {
      var intentos = 0;
      await abrirConfiguracion(
        tester,
        handler: (request) {
          if (!request.url.path.endsWith('/settings')) {
            return listaVacia();
          }
          intentos++;
          return intentos == 1 ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : respuesta(configuracion());
        },
      );
      expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();

      expect(find.text('Datos del taller'), findsOneWidget);
    });
  });

  group('menú lateral', () {
    testWidgets('el administrador ve «Configuración»', (tester) async {
      await abrirConfiguracion(tester, handler: servidor(configuracion()), abrirPantalla: false);
      expect(find.text('Configuración'), findsWidgets);
    });

    for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
      testWidgets('$rol no ve «Configuración»', (tester) async {
        await abrirConfiguracion(tester, role: rol, handler: servidor(configuracion()), abrirPantalla: false);
        expect(find.text('Configuración'), findsNothing);
      });
    }
  });
}
