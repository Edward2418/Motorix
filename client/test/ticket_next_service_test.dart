import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/providers/ticket_provider.dart';
import 'package:motorix_client/screens/ticket_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'ticket_screen_test.dart' show ImpresoraFalsa, ticketJson;
import 'package:motorix_client/services/ticket_printer.dart';

Future<ImpresoraFalsa> abrir(WidgetTester tester, Map<String, dynamic> ticket) async {
  tester.view.physicalSize = const Size(1400, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: 'ADMIN');
    }
    return FakeResponse(200, {'data': ticket});
  });
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');
  final impresora = ImpresoraFalsa();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
        ChangeNotifierProvider(create: (_) => TicketProvider(api)),
        Provider<TicketPrinter>.value(value: impresora),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const TicketScreen(orderId: 3)),
    ),
  );
  await tester.pumpAndSettle();
  return impresora;
}

void main() {
  group('modelo', () {
    test('lee nextService cuando viene en el ticket', () {
      final ticket = Ticket.fromJson({
        ...ticketJson(),
        'nextService': {'dueDate': '2027-05-19', 'dueMileage': 47000},
      });
      expect(ticket.nextService, isNotNull);
      expect(ticket.nextService!.dueDate, DateTime(2027, 5, 19));
      expect(ticket.nextService!.dueMileage, 47000);
    });

    test('sin nextService queda nulo, también en un ticket anterior al sprint', () {
      expect(Ticket.fromJson(ticketJson()).nextService, isNull);
    });

    test('acepta solo fecha o solo kilometraje', () {
      expect(Ticket.fromJson({...ticketJson(), 'nextService': {'dueDate': null, 'dueMileage': 18000}}).nextService!.dueDate, isNull);
      expect(Ticket.fromJson({...ticketJson(), 'nextService': {'dueDate': '2027-01-01', 'dueMileage': null}}).nextService!.dueMileage, isNull);
    });
  });

  group('pantalla del ticket', () {
    testWidgets('muestra «Próximo servicio» con la fecha y el kilometraje', (tester) async {
      await abrir(tester, {
        ...ticketJson(),
        'nextService': {'dueDate': '2027-05-19', 'dueMileage': 47000},
      });

      expect(find.text('Próximo servicio'), findsOneWidget);
      expect(find.textContaining('19 may 2027'), findsOneWidget);
      expect(find.textContaining('47,000'), findsOneWidget);
    });

    testWidgets('con solo kilometraje muestra únicamente el kilometraje', (tester) async {
      await abrir(tester, {
        ...ticketJson(),
        'nextService': {'dueDate': null, 'dueMileage': 18000},
      });

      expect(find.text('Próximo servicio'), findsOneWidget);
      expect(find.textContaining('18,000'), findsOneWidget);
      expect(find.textContaining(' 2027'), findsNothing);
    });

    testWidgets('con solo fecha muestra únicamente la fecha', (tester) async {
      await abrir(tester, {
        ...ticketJson(),
        'nextService': {'dueDate': '2027-01-15', 'dueMileage': null},
      });

      expect(find.text('Próximo servicio'), findsOneWidget);
      expect(find.textContaining('15 ene 2027'), findsOneWidget);
    });

    testWidgets('si el ticket no trae nextService no muestra la línea', (tester) async {
      await abrir(tester, ticketJson());

      expect(find.text('Próximo servicio'), findsNothing);
      expect(find.textContaining('Total'), findsWidgets, reason: 'el resto del ticket se muestra igual');
    });
  });

  group('ticket impreso', () {
    testWidgets('la impresora recibe el ticket con su próximo servicio', (tester) async {
      final impresora = await abrir(tester, {
        ...ticketJson(),
        'nextService': {'dueDate': '2027-05-19', 'dueMileage': 47000},
      });

      await tester.tap(find.text('Imprimir'));
      await tester.pumpAndSettle();

      expect(impresora.impresos.single.nextService?.dueMileage, 47000);
    });
  });
}
