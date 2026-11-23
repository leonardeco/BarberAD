import assert from "node:assert/strict";
import test from "node:test";

process.env.PG_DATABASE = "barberad_test";

function captureMail() {
  const lines: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    last: () => {
      const match = /enviado a (\S+): (\d{4})$/.exec(lines.at(-1) ?? "");
      return match ? { to: match[1], code: match[2] } : null;
    },
    stop: () => {
      console.info = original;
    },
  };
}

test("códigos de 4 dígitos y panel de administrador", async () => {
  const saved = { ...process.env };
  const mail = captureMail();
  try {
    delete process.env.RESEND_API_KEY;
    process.env.ADMIN_EMAILS = "Jefe@Admin.test";
    process.env.ADMIN_RECOVERY_EMAIL = "soporte@admin.test";

    const { ensureLocalPostgres } = await import("./local-postgres.ts");
    const { adminUrl } = await import("./database-url.ts");
    const { migrate } = await import("./migrate.ts");
    await ensureLocalPostgres();
    await migrate("barberad_test", { fresh: true });
    const auth = await import("./auth.ts");
    const shop = await import("./shop.ts");
    const codes = await import("./codes.ts");
    const { appDb } = await import("./db.ts");
    const postgres = (await import("postgres")).default;

    const boss = await auth.createOwnerAccount({ email: "jefe@admin.test", password: "clave-jefe-1", ownerName: "Jefe", shopName: "Central", takesAppointments: true });
    const dueno = await auth.createOwnerAccount({ email: "dueno@barberia.test", password: "clave-vieja-1", ownerName: "Ana", shopName: "La Navaja" });
    assert.equal(codes.isAdminEmail("JEFE@admin.test"), true);
    assert.equal(codes.isAdminEmail("dueno@barberia.test"), false);
    assert.equal(codes.maskEmail("soporte@admin.test"), "so*****@admin.test");

    // ----- Recuperar contraseña con código -----
    await auth.createSession(dueno.userId, "sesion-vieja");
    await codes.requestResetCode("dueno@barberia.test", "1.1.1.1");
    const first = mail.last()!;
    assert.equal(first.to, "dueno@barberia.test");
    const wrong = first.code === "0000" ? "0001" : "0000";
    await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", wrong, "clave-nueva-1", "1.1.1.1"), /no es correcto/);
    await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", "12", "clave-nueva-1", "1.1.1.1"), /4 números/);
    await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", first.code, "corta", "1.1.1.1"), /8 caracteres/);
    await codes.resetWithCode("dueno@barberia.test", first.code, "clave-nueva-1", "1.1.1.1");
    await auth.authenticate("dueno@barberia.test", "clave-nueva-1");
    assert.equal(await auth.readSessionUser("sesion-vieja"), null, "cambiar la contraseña cierra las otras sesiones");
    await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", first.code, "otra-clave-22", "1.1.1.1"), /No hay un código activo/);

    // Cinco fallos anulan el código, aunque después se acierte.
    await codes.requestResetCode("dueno@barberia.test", "2.2.2.2");
    const second = mail.last()!;
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", wrong === second.code ? "9999" : wrong, "clave-nueva-2", `3.3.3.${i}`), /no es correcto|Demasiados intentos con ese código/);
    }
    await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", second.code, "clave-nueva-2", "4.4.4.4"), /Demasiados intentos con ese código|Demasiados intentos\./);

    // Un código vencido no sirve.
    const admin = postgres(adminUrl("barberad_test"), { max: 1 });
    try {
      await admin`delete from auth_attempts`;
      await codes.requestResetCode("dueno@barberia.test", "5.5.5.5");
      const third = mail.last()!;
      await admin`update one_time_codes set expires_at = now() - interval '1 minute' where used_at is null`;
      await assert.rejects(() => codes.resetWithCode("dueno@barberia.test", third.code, "clave-nueva-3", "6.6.6.6"), /venció/);

      // Una cuenta que no existe no revela nada ni envía correo.
      const before = mail.lines.length;
      await codes.requestResetCode("nadie@barberia.test", "7.7.7.7");
      assert.equal(mail.lines.length, before);

      // La recuperación del administrador llega al correo de recuperación, no al de la cuenta.
      await codes.requestResetCode("jefe@admin.test", "8.8.8.8");
      assert.equal(mail.last()!.to, "soporte@admin.test");

      // ----- Panel de administrador -----
      await auth.createSession(boss.userId, "hash-jefe");
      await auth.createSession(dueno.userId, "hash-dueno");
      const overview = (hash: string) => appDb()`select app_admin_overview(${hash})`;
      await assert.rejects(() => overview("hash-jefe"), /forbidden/, "sin código no hay panel, ni siendo el jefe");
      await assert.rejects(() => overview("hash-dueno"), /forbidden/);
      await assert.rejects(() => appDb()`select * from app_admin_shops('hash-jefe', '')`, /forbidden/);
      await assert.rejects(() => codes.sendAdminCode(dueno.userId, "dueno@barberia.test"), /no es de administrador/);

      const masked = await codes.sendAdminCode(boss.userId, "jefe@admin.test");
      assert.equal(masked, "so*****@admin.test");
      const adminMail = mail.last()!;
      assert.equal(adminMail.to, "soporte@admin.test");
      const badAdmin = adminMail.code === "1111" ? "2222" : "1111";
      await assert.rejects(() => codes.verifyAdminCode("hash-jefe", boss.userId, badAdmin, "9.9.9.9"), /no es correcto/);
      // El código del administrador no sirve en la sesión de otra persona.
      await assert.rejects(() => codes.verifyAdminCode("hash-dueno", dueno.userId, adminMail.code, "9.9.9.9"), /No hay un código activo/);
      await codes.verifyAdminCode("hash-jefe", boss.userId, adminMail.code, "9.9.9.9");
      await assert.rejects(() => overview("hash-dueno"), /forbidden/);

      // ----- Indicadores -----
      await shop.createService(dueno, { name: "Corte", durationMin: 30, listPrice: 20000 });
      const [service] = await shop.listServices(dueno, true);
      const pay = (amount: number) =>
        shop.completeCheckout(dueno, { serviceId: service.id, amount, reason: "", tip: 1000, paymentMethod: "cash", clientKey: crypto.randomUUID() });
      await pay(20000);
      const voided = await pay(22000);
      await pay(25000);
      await shop.voidCheckout(dueno, voided.id, "error de digitación");

      const [{ app_admin_overview: o }] = await overview("hash-jefe");
      const data = o as {
        shops: { total: number; new7: number; active7: number; pro: number };
        users: { total: number; google: number };
        sales: { today: { cuts: number; charged: number; tips: number }; last30: { cuts: number; charged: number } };
        funnel: { registered: number; withServices: number; withCheckout: number };
        series: { day: string; cuts: number; charged: number; signups: number }[];
      };
      assert.equal(data.shops.total, 2);
      assert.equal(data.shops.new7, 2);
      assert.equal(data.shops.active7, 1);
      assert.equal(data.shops.pro, 0);
      assert.equal(data.users.total, 2);
      assert.equal(data.sales.today.cuts, 2, "el cobro anulado no cuenta");
      assert.equal(data.sales.today.charged, 45000);
      assert.equal(data.sales.last30.charged, 45000);
      assert.deepEqual([data.funnel.registered, data.funnel.withServices, data.funnel.withCheckout], [2, 1, 1]);
      assert.equal(data.series.length, 30);
      const lastDay = data.series.at(-1)!;
      assert.equal(lastDay.cuts, 2);
      assert.equal(lastDay.signups, 2);

      const rows = await appDb()<{ name: string; owner_email: string; charged30: number; cuts30: number; pro: boolean }[]>`
        select name, owner_email, charged30, cuts30, pro from app_admin_shops('hash-jefe', '')
      `;
      assert.deepEqual(rows.map((r) => r.name), ["La Navaja", "Central"], "la que cobró va primero");
      assert.equal(rows[0].charged30, 45000);
      assert.equal(rows[0].owner_email, "dueno@barberia.test");
      const found = await appDb()<{ name: string }[]>`select name from app_admin_shops('hash-jefe', 'navaja')`;
      assert.deepEqual(found.map((r) => r.name), ["La Navaja"]);
      assert.equal((await appDb()`select * from app_admin_shops('hash-jefe', '%')`).length, 0, "el % se busca literal");

      // ----- Soporte: código para un dueño -----
      const owner = await appDb()<{ user_id: string; email: string }[]>`select * from app_admin_owner_of('hash-jefe', ${dueno.shopId}::uuid)`;
      assert.equal(owner[0].email, "dueno@barberia.test");
      const supportCode = await codes.issueOwnerResetCode(owner[0].user_id);
      assert.match(supportCode, /^\d{4}$/);
      await codes.resetWithCode("dueno@barberia.test", supportCode, "clave-por-soporte-1", "10.10.10.10");
      await auth.authenticate("dueno@barberia.test", "clave-por-soporte-1");

      // Verificación vencida: deja de abrir el panel.
      await admin`update sessions set admin_verified_until = now() - interval '1 minute' where token_hash = 'hash-jefe'`;
      await assert.rejects(() => overview("hash-jefe"), /forbidden/);
    } finally {
      await admin.end();
    }
  } finally {
    mail.stop();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
