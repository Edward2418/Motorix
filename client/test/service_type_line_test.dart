import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/maintenance_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'maintenance_dialog_test.dart' show mantenimientoJson;
import 'order_detail_edit_test.dart' show orden;

Map<String, dynamic> tipo(int id, String nombre, {bool activo = true}) =>
    {'id': id, 'name': nombre, 'intervalDays': 180, 'intervalKm': 5000, 'active': activo};

Map<String, dynamic> servicio(int id, String descripcion, double importe, {int? tipoId, String? tipoNombre}) => {
      'id': id,
      'description': descripcion,
      'amount': importe,
      'serviceTypeId': tipoId,
      'serviceTypeName': tipoNombre,
    };

/// Servidor falso: la orden con sus líneas, el catálogo de tipos activos y la propuesta de mantenimiento.
FakeHandler servidor({
  List<Map<String, dynamic>> servicios = const [],
  List<Map<String, dynamic>> tiposActivos = const [],
  List<Map<String, dynamic>> propuestas = const [],
  FakeResponse Function(http.Request)? alGuardar,
}) =>
    (request) {
      final ruta = request.url.path;
      if (ruta.endsWith('/service-types')) {
        return FakeResponse(200, {'data': tiposActivos});
      }
      if (ruta.endsWith('/maintenance-suggestion')) {
        return FakeResponse(200, {'data': propuestas});
      }
      if (request.method != 'GET' && alGuardar != null) {
        return alGuardar(request);
      }
      return FakeResponse(200, {'data': orden(servicios: servicios)});
    };

Future<List<http.Request>> abrirDetalle(WidgetTester tester, FakeHandler handler, {String role = 'MECHANIC'}) async {
  tester.view.physicalSize = const Size(1400, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    return handler(request);
  }, log: log);
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
        ChangeNotifierProvider(create: (_) => MaintenanceProvider(api)),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const OrderDetailScreen(orderId: 3)),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

Iterable<http.Request> cambios(List<http.Request> log, String metodo, String sufijo) =>
    log.where((r) => r.method == metodo && r.url.path.endsWith(sufijo));

void main() {
  group('tipo de servicio en las líneas', () {
    testWidgets('al agregar un servicio pide solo los tipos activos y ofrece dejarlo sin tipo', (tester) async {
      final log = await abrirDetalle(tester, servidor(tiposActivos: [tipo(5, 'Cambio de aceite'), tipo(6, 'Frenos')]));

      await tester.tap(find.text('Agregar servicio'));
      await tester.pumpAndSettle();

      final consulta = log.where((r) => r.url.path.endsWith('/service-types')).single;
      expect(consulta.url.queryParameters['active'], 'true');
      await tester.tap(find.text('Sin tipo'));
      await tester.pumpAndSettle();
      expect(find.text('Cambio de aceite'), findsWidgets);
      expect(find.text('Frenos'), findsWidgets);
      expect(find.text('Sin tipo'), findsWidgets);
    });

    testWidgets('elegir un tipo lo envía con la línea', (tester) async {
      final log = await abrirDetalle(
        tester,
        servidor(tiposActivos: [tipo(5, 'Cambio de aceite')], alGuardar: (_) => FakeResponse(201, {'data': orden()})),
      );

      await tester.tap(find.text('Agregar servicio'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Aceite y filtro');
      await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '500');
      await tester.tap(find.text('Sin tipo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cambio de aceite').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final cuerpo = jsonDecode(cambios(log, 'POST', '/orders/3/services').single.body) as Map<String, dynamic>;
      expect(cuerpo['serviceTypeId'], 5);
      expect(cuerpo['description'], 'Aceite y filtro');
    });

    testWidgets('dejarlo sin tipo no envía serviceTypeId', (tester) async {
      final log = await abrirDetalle(
        tester,
        servidor(tiposActivos: [tipo(5, 'Cambio de aceite')], alGuardar: (_) => FakeResponse(201, {'data': orden()})),
      );

      await tester.tap(find.text('Agregar servicio'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Diagnóstico');
      await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '200');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final cuerpo = jsonDecode(cambios(log, 'POST', '/orders/3/services').single.body) as Map<String, dynamic>;
      expect(cuerpo.containsKey('serviceTypeId'), isFalse);
    });

    testWidgets('la mano de obra no ofrece tipo', (tester) async {
      await abrirDetalle(tester, servidor(tiposActivos: [tipo(5, 'Cambio de aceite')]));

      await tester.tap(find.text('Agregar mano de obra'));
      await tester.pumpAndSettle();

      expect(find.text('Tipo de servicio (opcional)'), findsNothing);
      expect(find.text('Sin tipo'), findsNothing);
    });

    testWidgets('si el catálogo no tiene tipos activos el diálogo no muestra el selector', (tester) async {
      await abrirDetalle(tester, servidor());

      await tester.tap(find.text('Agregar servicio'));
      await tester.pumpAndSettle();

      expect(find.text('Tipo de servicio (opcional)'), findsNothing);
    });

    testWidgets('si el catálogo falla, el servicio se puede agregar igual, sin tipo', (tester) async {
      await abrirDetalle(
        tester,
        (request) => request.url.path.endsWith('/service-types')
            ? apiError(500, 'INTERNAL_ERROR', 'Error')
            : FakeResponse(200, {'data': orden()}),
      );

      await tester.tap(find.text('Agregar servicio'));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Descripción'), findsOneWidget);
      expect(find.text('Tipo de servicio (opcional)'), findsNothing);
    });

    testWidgets('la lista de servicios muestra el tipo de cada línea', (tester) async {
      await abrirDetalle(
        tester,
        servidor(servicios: [servicio(1, 'Aceite y filtro', 500, tipoId: 5, tipoNombre: 'Cambio de aceite'), servicio(2, 'Diagnóstico', 200)]),
      );

      expect(find.text('Aceite y filtro'), findsOneWidget);
      expect(find.text('Tipo: Cambio de aceite'), findsOneWidget);
      expect(find.textContaining('Tipo:'), findsOneWidget, reason: 'la línea sin tipo no muestra nada');
    });

    testWidgets('al editar, el tipo actual aparece elegido y se puede quitar', (tester) async {
      final log = await abrirDetalle(
        tester,
        servidor(
          servicios: [servicio(1, 'Aceite y filtro', 500, tipoId: 5, tipoNombre: 'Cambio de aceite')],
          tiposActivos: [tipo(5, 'Cambio de aceite')],
          alGuardar: (_) => FakeResponse(200, {'data': orden()}),
        ),
      );

      await tester.tap(find.byTooltip('Editar Aceite y filtro'));
      await tester.pumpAndSettle();
      expect(find.text('Cambio de aceite'), findsWidgets, reason: 'el tipo actual viene elegido');
      await tester.tap(find.text('Cambio de aceite').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sin tipo').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final cuerpo = jsonDecode(cambios(log, 'PUT', '/orders/3/services/1').single.body) as Map<String, dynamic>;
      expect(cuerpo.containsKey('serviceTypeId'), isTrue);
      expect(cuerpo['serviceTypeId'], isNull);
    });

    testWidgets('una línea con un tipo ya desactivado lo conserva al editarla', (tester) async {
      final log = await abrirDetalle(
        tester,
        servidor(
          servicios: [servicio(1, 'Servicio viejo', 300, tipoId: 9, tipoNombre: 'Tipo retirado')],
          tiposActivos: [tipo(5, 'Cambio de aceite')],
          alGuardar: (_) => FakeResponse(200, {'data': orden()}),
        ),
      );

      await tester.tap(find.byTooltip('Editar Servicio viejo'));
      await tester.pumpAndSettle();
      expect(find.text('Tipo retirado (desactivado)'), findsOneWidget);
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      final cuerpo = jsonDecode(cambios(log, 'PUT', '/orders/3/services/1').single.body) as Map<String, dynamic>;
      expect(cuerpo['serviceTypeId'], 9);
    });
  });

  group('propuesta del próximo mantenimiento', () {
    Map<String, dynamic> propuesta({String descripcion = 'Cambio de aceite', String? fecha = '2027-05-19', int? km = 47000}) => {
          'serviceTypeId': 5,
          'serviceTypeName': descripcion,
          'description': descripcion,
          'dueDate': fecha,
          'dueMileage': km,
        };

    Future<void> abrirDialogo(WidgetTester tester) async {
      await tester.tap(find.text('Programar mantenimiento'));
      await tester.pumpAndSettle();
    }

    testWidgets('el diálogo precarga la descripción, la fecha y el kilometraje propuestos', (tester) async {
      final log = await abrirDetalle(tester, servidor(propuestas: [propuesta()]));

      await abrirDialogo(tester);

      expect(log.where((r) => r.url.path.endsWith('/orders/3/maintenance-suggestion')), hasLength(1));
      expect(find.widgetWithText(TextFormField, 'Cambio de aceite'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '47000'), findsOneWidget);
      expect(find.text('19 may 2027'), findsOneWidget);
      expect(find.textContaining('Propuesta a partir del tipo de servicio'), findsOneWidget);
    });

    testWidgets('la propuesta se puede corregir antes de guardar', (tester) async {
      final log = await abrirDetalle(
        tester,
        servidor(propuestas: [propuesta()], alGuardar: (_) => FakeResponse(201, {'data': mantenimientoJson()})),
      );

      await abrirDialogo(tester);
      await tester.enterText(find.widgetWithText(TextFormField, '47000'), '48000');
      await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
      await tester.pumpAndSettle();

      final cuerpo = jsonDecode(cambios(log, 'POST', '/orders/3/maintenance').single.body) as Map<String, dynamic>;
      expect(cuerpo['description'], 'Cambio de aceite');
      expect(cuerpo['dueMileage'], 48000);
      expect(cuerpo['dueDate'], '2027-05-19');
    });

    testWidgets('un tipo sin intervalo en días propone solo el kilometraje', (tester) async {
      await abrirDetalle(tester, servidor(propuestas: [propuesta(fecha: null)]));

      await abrirDialogo(tester);

      expect(find.text('Elegir fecha'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '47000'), findsOneWidget);
    });

    testWidgets('con varias propuestas permite elegir cuál usar', (tester) async {
      await abrirDetalle(
        tester,
        servidor(propuestas: [propuesta(), propuesta(descripcion: 'Frenos', fecha: null, km: 62000)]),
      );

      await abrirDialogo(tester);
      expect(find.widgetWithText(TextFormField, 'Cambio de aceite'), findsOneWidget);
      await tester.tap(find.text('Propuesta: Cambio de aceite'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Propuesta: Frenos').last);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Frenos'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '62000'), findsOneWidget);
    });

    testWidgets('sin propuesta el diálogo queda vacío, como antes', (tester) async {
      await abrirDetalle(tester, servidor());

      await abrirDialogo(tester);

      expect(find.textContaining('Propuesta a partir del tipo de servicio'), findsNothing);
      expect(find.text('Elegir fecha'), findsOneWidget);
    });

    testWidgets('si la propuesta falla el diálogo se abre vacío y se puede programar a mano', (tester) async {
      await abrirDetalle(
        tester,
        (request) => request.url.path.endsWith('/maintenance-suggestion')
            ? apiError(500, 'INTERNAL_ERROR', 'Error')
            : FakeResponse(200, {'data': orden()}),
      );

      await abrirDialogo(tester);

      expect(find.text('Programar próximo mantenimiento'), findsOneWidget);
      expect(find.text('Elegir fecha'), findsOneWidget);
    });
  });
}
