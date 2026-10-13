import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:motorix_client/widgets/service_mileage_dialog.dart';

import 'helpers/fake_api.dart';
import 'order_status_actions_test.dart' show abrirDetalle, devuelve, orden;

/// Pantalla mínima con un botón que abre el diálogo y guarda lo que devuelve.
Future<ValueNotifier<Object?>> abrirDialogo(WidgetTester tester, {required bool correccion}) async {
  final resultado = ValueNotifier<Object?>('sin respuesta');
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(useGoogleFonts: false),
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () async {
                resultado.value = correccion
                    ? await showServiceMileageCorrectionDialog(context, entryMileage: 45800, current: 46500)
                    : await showServiceMileageDialog(context, entryMileage: 45800);
              },
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Abrir'));
  await tester.pumpAndSettle();
  return resultado;
}

void main() {
  testWidgets('propone el kilometraje de entrada y lo devuelve al confirmar', (tester) async {
    final resultado = await abrirDialogo(tester, correccion: false);

    expect(find.widgetWithText(TextFormField, '45800'), findsOneWidget);
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(resultado.value, 45800);
  });

  testWidgets('no deja continuar con un kilometraje menor al de entrada', (tester) async {
    final resultado = await abrirDialogo(tester, correccion: false);

    await tester.enterText(find.byType(TextFormField), '45000');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No puede ser menor al kilometraje de entrada'), findsOneWidget);
    expect(resultado.value, 'sin respuesta', reason: 'el diálogo sigue abierto');
  });

  testWidgets('rechaza un valor vacío o que no es un número entero', (tester) async {
    await abrirDialogo(tester, correccion: false);

    await tester.enterText(find.byType(TextFormField), '');
    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Indica el kilometraje del servicio.'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField), '12ab');
    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Escribe un número entero válido.'), findsOneWidget);
  });

  testWidgets('cancelar el diálogo no devuelve ningún valor', (tester) async {
    final resultado = await abrirDialogo(tester, correccion: false);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(resultado.value, isNull);
  });

  testWidgets('la corrección parte del kilometraje actual y exige el motivo', (tester) async {
    final resultado = await abrirDialogo(tester, correccion: true);

    expect(find.widgetWithText(TextFormField, '46500'), findsOneWidget);
    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Indica el motivo de la corrección.'), findsOneWidget);
    expect(resultado.value, 'sin respuesta');

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la corrección'), 'Lectura equivocada');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(resultado.value, (mileage: 46500, reason: 'Lectura equivocada'));
  });

  testWidgets('solo el administrador ve el botón para corregir el kilometraje en una orden terminada', (tester) async {
    final terminada = orden(estado: 'TERMINADO', permitidas: ['ENTREGADO'])..['serviceMileage'] = 46000;

    await abrirDetalle(tester, role: 'ADMIN', handler: devuelve(terminada));
    expect(find.text('Corregir kilometraje del servicio'), findsOneWidget);
    expect(find.text('Kilometraje del servicio'), findsOneWidget, reason: 'se muestra el dato en el resumen');
  });

  for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el rol $rol no ve el botón para corregir el kilometraje', (tester) async {
      final terminada = orden(estado: 'TERMINADO', permitidas: [])..['serviceMileage'] = 46000;
      await abrirDetalle(tester, role: rol, handler: devuelve(terminada));
      expect(find.text('Corregir kilometraje del servicio'), findsNothing);
    });
  }

  testWidgets('la corrección envía el kilometraje y el motivo al servidor', (tester) async {
    final terminada = orden(estado: 'ENTREGADO', permitidas: [])..['serviceMileage'] = 46000;
    final log = await abrirDetalle(tester, role: 'ADMIN', handler: (request) {
      if (request.method == 'PUT') {
        return FakeResponse(200, {
          'data': {...terminada, 'serviceMileage': 45900, 'serviceMileageCorrectionReason': 'Lectura equivocada'},
        });
      }
      return FakeResponse(200, {'data': terminada});
    });

    await tester.tap(find.text('Corregir kilometraje del servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje del servicio'), '45900');
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la corrección'), 'Lectura equivocada');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final peticion = log.singleWhere((r) => r.method == 'PUT');
    expect(peticion.url.path, endsWith('/orders/3/service-mileage'));
    expect(jsonDecode(peticion.body), {'serviceMileage': 45900, 'reason': 'Lectura equivocada'});
    expect(find.text('Se corrigió el kilometraje del servicio.'), findsOneWidget);
    expect(find.textContaining('Kilometraje del servicio corregido: Lectura equivocada'), findsOneWidget);
  });
}
