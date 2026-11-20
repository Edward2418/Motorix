import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> registro(
  int id, {
  String accion = 'PART_PRICE_CHANGED',
  String? actor = 'admin',
  int? usuario = 1,
  String? detalle = 'precio de venta: 180.00 → 250.00',
}) =>
    {
      'id': id,
      'userId': usuario,
      'actor': actor,
      'action': accion,
      'entity': 'PART',
      'entityId': 7,
      'detail': detalle,
      'createdAt': '2026-11-20T10:30:00.000Z',
    };

Map<String, dynamic> usuarioJson(int id, String nombre) => {
      ...userJson(role: 'RECEPTIONIST', username: 'u$id', name: nombre),
      'id': id,
    };

FakeResponse pagina(List<Map<String, dynamic>> datos, {int? total, int page = 1, int pageSize = 20}) =>
    FakeResponse(200, {
      'data': datos,
      'meta': {'page': page, 'pageSize': pageSize, 'total': total ?? datos.length},
    });

FakeHandler servidor({
  required FakeResponse Function(http.Request) bitacora,
  List<Map<String, dynamic>>? usuarios,
}) =>
    (request) {
      if (request.url.path.endsWith('/audit-log')) {
        return bitacora(request);
      }
      if (request.url.path.endsWith('/users')) {
        return pagina(usuarios ?? [usuarioJson(1, 'Administrador'), usuarioJson(2, 'Lucía Pérez')]);
      }
      return listaVacia();
    };

Future<List<http.Request>> abrirBitacora(
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
    await tester.tap(find.text('Bitácora').first);
    await tester.pumpAndSettle();
  }
  return log;
}

List<http.Request> consultas(List<http.Request> log) => log.where((r) => r.url.path.endsWith('/audit-log')).toList();

void main() {
  group('lista de la bitácora', () {
    testWidgets('muestra fecha, usuario, acción en español y detalle de cada registro', (tester) async {
      await abrirBitacora(
        tester,
        handler: servidor(
          bitacora: (_) => pagina([
            registro(1),
            registro(2, accion: 'ACCOUNT_LOCKED', actor: 'lucia', detalle: 'bloqueo de 15 minutos'),
          ]),
        ),
      );

      expect(find.text('Fecha'), findsOneWidget);
      expect(find.text('Usuario'), findsWidgets);
      expect(find.text('Acción'), findsWidgets);
      expect(find.text('Detalle'), findsOneWidget);
      expect(find.text('Cambio de precio de refacción'), findsOneWidget);
      expect(find.text('Cuenta bloqueada'), findsOneWidget);
      expect(find.text('precio de venta: 180.00 → 250.00'), findsOneWidget);
      expect(find.text('bloqueo de 15 minutos'), findsOneWidget);
      expect(find.text('lucia'), findsOneWidget);
      expect(find.textContaining('2026'), findsWidgets);
    });

    testWidgets('un inicio fallido de una cuenta inexistente se muestra sin usuario', (tester) async {
      await abrirBitacora(
        tester,
        handler: servidor(
          bitacora: (_) => pagina([registro(1, accion: 'LOGIN_FAILED', actor: null, usuario: null, detalle: null)]),
        ),
      );

      expect(find.text('Inicio de sesión fallido'), findsOneWidget);
      expect(find.text('Sin usuario'), findsOneWidget);
    });

    testWidgets('no ofrece editar ni borrar registros', (tester) async {
      await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));

      expect(find.byTooltip('Editar'), findsNothing);
      expect(find.byTooltip('Eliminar'), findsNothing);
      expect(find.text('Acciones'), findsNothing);
      expect(find.textContaining('Editar'), findsNothing);
      expect(find.textContaining('Eliminar'), findsNothing);
      expect(find.textContaining('Borrar'), findsNothing);
    });
  });

  group('estados', () {
    testWidgets('muestra el estado de carga mientras el servidor responde', (tester) async {
      final espera = Completer<void>();
      await abrirBitacora(
        tester,
        handler: servidor(bitacora: (_) => pagina([registro(1)])),
        abrirPantalla: false,
        hold: (request) => request.url.path.endsWith('/audit-log') ? espera.future : null,
      );
      await tester.tap(find.text('Bitácora').first);
      await tester.pump();
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsWidgets);

      espera.complete();
      await tester.pumpAndSettle();
      expect(find.text('Cambio de precio de refacción'), findsOneWidget);
    });

    testWidgets('sin registros muestra un mensaje útil', (tester) async {
      await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([])));
      expect(find.textContaining('No hay registros'), findsOneWidget);
    });

    testWidgets('con un error del servidor muestra el mensaje y permite reintentar', (tester) async {
      var falla = true;
      await abrirBitacora(
        tester,
        handler: servidor(
          bitacora: (_) => falla ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : pagina([registro(1)]),
        ),
      );

      expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

      falla = false;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();

      expect(find.text('Cambio de precio de refacción'), findsOneWidget);
    });
  });

  group('filtros y paginación', () {
    testWidgets('filtra por fecha: envía from y to', (tester) async {
      final log = await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-11-01');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-11-15');
      await tester.tap(find.text('Aplicar filtros'));
      await tester.pumpAndSettle();

      final ultima = consultas(log).last.url.queryParameters;
      expect(ultima['from'], '2026-11-01');
      expect(ultima['to'], '2026-11-15');
      expect(ultima['page'], '1');
    });

    testWidgets('una fecha mal escrita muestra el error y no consulta', (tester) async {
      final log = await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));
      final antes = consultas(log).length;

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '01/11/2026');
      await tester.tap(find.text('Aplicar filtros'));
      await tester.pumpAndSettle();

      expect(find.text('Escribe la fecha como AAAA-MM-DD, por ejemplo 2026-11-01.'), findsOneWidget);
      expect(consultas(log).length, antes);
    });

    testWidgets('un rango con la fecha inicial posterior a la final muestra el error y no consulta', (tester) async {
      final log = await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));
      final antes = consultas(log).length;

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-11-20');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-11-01');
      await tester.tap(find.text('Aplicar filtros'));
      await tester.pumpAndSettle();

      expect(find.text('La fecha inicial no puede ser posterior a la final.'), findsOneWidget);
      expect(consultas(log).length, antes);
    });

    testWidgets('filtra por usuario y por acción', (tester) async {
      final log = await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));

      await tester.tap(find.text('Todos los usuarios'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lucía Pérez').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Todas las acciones'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pago cancelado').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Aplicar filtros'));
      await tester.pumpAndSettle();

      final ultima = consultas(log).last.url.queryParameters;
      expect(ultima['userId'], '2');
      expect(ultima['action'], 'PAYMENT_CANCELLED');
    });

    testWidgets('limpiar vuelve a consultar sin filtros', (tester) async {
      final log = await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([registro(1)])));
      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-11-01');
      await tester.tap(find.text('Aplicar filtros'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Limpiar'));
      await tester.pumpAndSettle();

      final ultima = consultas(log).last.url.queryParameters;
      expect(ultima.containsKey('from'), isFalse);
      expect(ultima.containsKey('action'), isFalse);
      expect(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), findsOneWidget);
    });

    testWidgets('pagina: con 45 registros la segunda página se pide con page=2', (tester) async {
      final log = await abrirBitacora(
        tester,
        handler: servidor(bitacora: (request) {
          final page = int.parse(request.url.queryParameters['page'] ?? '1');
          return pagina([registro(page)], total: 45, page: page);
        }),
      );

      expect(find.text('1–20 de 45'), findsOneWidget);
      await tester.tap(find.byTooltip('Página siguiente'));
      await tester.pumpAndSettle();

      expect(consultas(log).last.url.queryParameters['page'], '2');
      expect(consultas(log).last.url.queryParameters['pageSize'], '20');
    });
  });

  group('destino del menú', () {
    testWidgets('el administrador ve «Bitácora»', (tester) async {
      await abrirBitacora(tester, handler: servidor(bitacora: (_) => pagina([])), abrirPantalla: false);
      expect(find.text('Bitácora'), findsWidgets);
    });

    testWidgets('recepción y mecánico no ven «Bitácora»', (tester) async {
      for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
        await abrirBitacora(tester, role: rol, handler: servidor(bitacora: (_) => pagina([])), abrirPantalla: false);
        expect(find.text('Bitácora'), findsNothing, reason: 'el rol $rol no debe ver la bitácora');
        await tester.pumpWidget(const SizedBox());
      }
    });
  });
}
