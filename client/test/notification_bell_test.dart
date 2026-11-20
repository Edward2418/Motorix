import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:motorix_client/providers/navigation_provider.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:motorix_client/widgets/notification_bell.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> aviso(String key, String type, int severity, String titulo, {String modulo = 'inventory', int id = 1}) => {
      'key': key,
      'type': type,
      'severity': severity,
      'title': titulo,
      'detail': 'Detalle de $titulo',
      'read': false,
      'target': {'module': modulo, 'id': id},
    };

Map<String, dynamic> centroConAvisos() => {
      'unread': 3,
      'groups': [
        {
          'type': 'STOCK_OUT',
          'label': 'Refacciones agotadas',
          'total': 1,
          'unread': 1,
          'items': [aviso('STOCK:2', 'STOCK_OUT', 2, 'Filtro de aceite agotada', id: 2)],
        },
        {
          'type': 'STOCK_LOW',
          'label': 'Stock bajo',
          'total': 12,
          'unread': 2,
          'items': [
            aviso('STOCK:1', 'STOCK_LOW', 1, 'Bujía de iridio', id: 1),
            aviso('STOCK:3', 'STOCK_LOW', 1, 'Banda de distribución', id: 3),
          ],
        },
      ],
    };

FakeResponse responder(http.Request request, {int contador = 3, Map<String, dynamic>? centro}) {
  if (request.url.path.endsWith('/notifications/count')) {
    return FakeResponse(200, {
      'data': {'unread': contador},
    });
  }
  return FakeResponse(200, {'data': centro ?? centroConAvisos()});
}

/// Monta la campana con su proveedor, igual que el encabezado de la aplicación.
Future<({NotificationsProvider provider, NavigationProvider navegacion, List<http.Request> log})> abrirCampana(
  WidgetTester tester, {
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1500, 2200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi(handler, log: log);
  final provider = NotificationsProvider(api);
  final navegacion = NavigationProvider();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<NotificationsProvider>.value(value: provider),
        ChangeNotifierProvider<NavigationProvider>.value(value: navegacion),
      ],
      child: MaterialApp(
        theme: buildAppTheme(useGoogleFonts: false),
        home: const Scaffold(body: Align(alignment: Alignment.topRight, child: NotificationBell())),
      ),
    ),
  );
  await provider.refreshCount();
  await tester.pumpAndSettle();
  return (provider: provider, navegacion: navegacion, log: log);
}

void main() {
  testWidgets('la campana muestra el contador de avisos sin leer', (tester) async {
    await abrirCampana(tester, handler: (request) => responder(request));
    expect(find.byIcon(LucideIcons.bell), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('sin avisos la campana no muestra contador', (tester) async {
    await abrirCampana(tester, handler: (request) => responder(request, contador: 0));
    expect(find.byIcon(LucideIcons.bell), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('con más de 99 avisos el contador muestra 99+', (tester) async {
    await abrirCampana(tester, handler: (request) => responder(request, contador: 150));
    expect(find.text('99+'), findsOneWidget);
  });

  testWidgets('al abrirla muestra los grupos con sus avisos y los que no caben', (tester) async {
    await abrirCampana(tester, handler: (request) => responder(request));
    await tester.tap(find.byIcon(LucideIcons.bell));
    await tester.pumpAndSettle();
    expect(find.text('Avisos'), findsOneWidget);
    expect(find.text('Refacciones agotadas (1)'), findsOneWidget);
    expect(find.text('Stock bajo (12)'), findsOneWidget);
    expect(find.text('Filtro de aceite agotada'), findsOneWidget);
    expect(find.text('Bujía de iridio'), findsOneWidget);
    expect(find.text('y 10 más'), findsOneWidget);
  });

  testWidgets('mientras consulta muestra un indicador de carga', (tester) async {
    await abrirCampana(tester, handler: (request) => responder(request));
    await tester.tap(find.byIcon(LucideIcons.bell));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('sin avisos muestra el mensaje de vacío', (tester) async {
    await abrirCampana(
      tester,
      handler: (request) => responder(request, contador: 0, centro: {'unread': 0, 'groups': <dynamic>[]}),
    );
    await tester.tap(find.byIcon(LucideIcons.bell));
    await tester.pumpAndSettle();
    expect(find.text('No tienes avisos pendientes.'), findsOneWidget);
  });

  testWidgets('si la consulta falla muestra un error claro y permite reintentar', (tester) async {
    var intentos = 0;
    await abrirCampana(
      tester,
      handler: (request) {
        if (request.url.path.endsWith('/notifications/count')) {
          return FakeResponse(200, {
            'data': {'unread': 0},
          });
        }
        intentos++;
        return intentos == 1 ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : FakeResponse(200, {'data': centroConAvisos()});
      },
    );
    await tester.tap(find.byIcon(LucideIcons.bell));
    await tester.pumpAndSettle();
    expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Refacciones agotadas (1)'), findsOneWidget);
  });

  testWidgets('si el contador falla no interrumpe: la campana queda sin contador', (tester) async {
    await abrirCampana(tester, handler: (_) => apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.'));
    expect(tester.takeException(), isNull);
    expect(find.byIcon(LucideIcons.bell), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  group('marcar leído y abrir el módulo', () {
    Map<String, dynamic> centroDeOrdenes() => {
          'unread': 3,
          'groups': [
            {
              'type': 'ORDER_STALE',
              'label': 'Órdenes detenidas',
              'total': 1,
              'unread': 1,
              'items': [aviso('ORDER:41', 'ORDER_STALE', 1, 'OS-2026-0041', modulo: 'orders', id: 41)],
            },
            {
              'type': 'STOCK_LOW',
              'label': 'Stock bajo',
              'total': 1,
              'unread': 1,
              'items': [aviso('STOCK:7', 'STOCK_LOW', 1, 'Bujía de iridio', modulo: 'inventory', id: 7)],
            },
          ],
        };

    FakeResponse servidor(http.Request request) {
      if (request.url.path.endsWith('/notifications/read')) {
        return FakeResponse(200, {
          'data': {'key': 'ORDER:41', 'read': true, 'unread': 2},
        });
      }
      return responder(request, centro: centroDeOrdenes());
    }

    testWidgets('tocar un aviso de orden lo marca como leído, baja el contador y abre el detalle de la orden', (tester) async {
      final app = await abrirCampana(tester, handler: servidor);
      expect(find.text('3'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      await tester.tap(find.text('OS-2026-0041'));
      await tester.pumpAndSettle();

      final lectura = app.log.where((r) => r.method == 'POST' && r.url.path.endsWith('/notifications/read')).toList();
      expect(lectura, hasLength(1));
      expect(lectura.single.body, contains('ORDER:41'));
      expect(app.provider.unread, 2);
      expect(find.text('2'), findsOneWidget);
      expect(app.navegacion.selectedLabel, 'Órdenes de servicio');
      expect(app.navegacion.takePendingOrderId(), 41);
      expect(find.text('Avisos'), findsNothing);
    });

    testWidgets('un aviso de stock abre Inventario sin orden pendiente', (tester) async {
      final app = await abrirCampana(tester, handler: servidor);
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Bujía de iridio'));
      await tester.pumpAndSettle();

      expect(app.navegacion.selectedLabel, 'Inventario');
      expect(app.navegacion.takePendingOrderId(), isNull);
    });

    testWidgets('si no se pudo marcar como leído, igual se abre el módulo y no hay error', (tester) async {
      final app = await abrirCampana(
        tester,
        handler: (request) => request.url.path.endsWith('/notifications/read')
            ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.')
            : responder(request, centro: centroDeOrdenes()),
      );
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      await tester.tap(find.text('OS-2026-0041'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(app.provider.unread, 3);
      expect(app.navegacion.selectedLabel, 'Órdenes de servicio');
    });
  });

  group('mantenimientos y citas de la recepción', () {
    Map<String, dynamic> centroDeRecepcion() => {
          'unread': 3,
          'groups': [
            {
              'type': 'MAINTENANCE_OVERDUE',
              'label': 'Mantenimientos vencidos',
              'total': 1,
              'unread': 1,
              'items': [aviso('MAINT:5', 'MAINTENANCE_OVERDUE', 2, 'Cambio de banda', modulo: 'maintenance', id: 5)],
            },
            {
              'type': 'MAINTENANCE_SOON',
              'label': 'Mantenimientos próximos',
              'total': 1,
              'unread': 1,
              'items': [aviso('MAINT:6', 'MAINTENANCE_SOON', 1, 'Cambio de aceite', modulo: 'maintenance', id: 6)],
            },
            {
              'type': 'APPOINTMENT_TODAY',
              'label': 'Citas de hoy',
              'total': 1,
              'unread': 1,
              'items': [
                {
                  ...aviso('APPT:9', 'APPOINTMENT_TODAY', 1, 'Cita de Cliente Uno', modulo: 'appointments', id: 9),
                  'detail': '12:00 · REC1001 · Nissan Versa 2020 · Pendiente',
                },
              ],
            },
          ],
        };

    testWidgets('«Vencido» y «Próximo» se distinguen con texto, no solo con color', (tester) async {
      await abrirCampana(tester, handler: (request) => responder(request, centro: centroDeRecepcion()));
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      expect(find.text('Vencido'), findsOneWidget);
      expect(find.text('Próximo'), findsOneWidget);
      expect(find.text('Cambio de banda'), findsOneWidget);
      expect(find.text('Cambio de aceite'), findsOneWidget);
    });

    testWidgets('el aviso de una cita muestra la hora en el detalle', (tester) async {
      await abrirCampana(tester, handler: (request) => responder(request, centro: centroDeRecepcion()));
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      expect(find.text('Citas de hoy (1)'), findsOneWidget);
      expect(find.textContaining('12:00'), findsOneWidget);
    });

    testWidgets('tocar un aviso de mantenimiento abre Mantenimientos y uno de cita abre Citas', (tester) async {
      final app = await abrirCampana(tester, handler: (request) => responder(request, centro: centroDeRecepcion()));
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cambio de banda'));
      await tester.pumpAndSettle();
      expect(app.navegacion.selectedLabel, 'Mantenimientos');

      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cita de Cliente Uno'));
      await tester.pumpAndSettle();
      expect(app.navegacion.selectedLabel, 'Citas');
    });

    testWidgets('la recepción no ve ningún grupo de stock cuando el servidor no lo envía', (tester) async {
      await abrirCampana(tester, handler: (request) => responder(request, centro: centroDeRecepcion()));
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      expect(find.textContaining('Stock bajo'), findsNothing);
      expect(find.textContaining('Refacciones agotadas'), findsNothing);
    });
  });

  group('mecánico', () {
    testWidgets('la campana muestra solo avisos de órdenes y ningún grupo de stock, citas ni mantenimientos', (tester) async {
      final centroMecanico = {
        'unread': 2,
        'groups': [
          {
            'type': 'ORDER_STALE',
            'label': 'Órdenes detenidas',
            'total': 2,
            'unread': 2,
            'items': [
              aviso('ORDER:41', 'ORDER_STALE', 1, 'Orden OS-2026-0041', modulo: 'orders', id: 41),
              aviso('ORDER:42', 'ORDER_STALE', 1, 'Orden OS-2026-0042', modulo: 'orders', id: 42),
            ],
          },
        ],
      };
      await abrirCampana(tester, handler: (request) => responder(request, contador: 2, centro: centroMecanico));
      expect(find.text('2'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.bell));
      await tester.pumpAndSettle();

      expect(find.text('Órdenes detenidas (2)'), findsOneWidget);
      expect(find.text('Orden OS-2026-0041'), findsOneWidget);
      expect(find.text('Orden OS-2026-0042'), findsOneWidget);
      expect(find.textContaining('Stock bajo'), findsNothing);
      expect(find.textContaining('Refacciones agotadas'), findsNothing);
      expect(find.textContaining('Citas de hoy'), findsNothing);
      expect(find.textContaining('Mantenimientos'), findsNothing);
    });
  });

  testWidgets('no hay consulta periódica: sin acciones no se vuelve a consultar el contador', (tester) async {
    final servidor = await abrirCampana(tester, handler: (request) => responder(request));
    final antes = servidor.log.length;
    await tester.pump(const Duration(minutes: 5));
    expect(servidor.log.length, antes);
  });
}
