// ============================================================================
// SERVIÇO DE NOTIFICAÇÕES E LEMBRETES 24H ANTES DO AGENDAMENTO
// ============================================================================

import { CustomerAppointment } from '../types';

export interface ReminderAnalysis {
  status: 'due' | 'scheduled' | 'sent' | 'past' | 'inactive';
  label: string;
  badgeClass: string;
  hoursUntilService: number;
  reminderTargetDate: Date | null;
  serviceDate: Date | null;
  canSendNow: boolean;
}

/**
 * Converte data e hora de um agendamento para um objeto Date seguro.
 * Suporta formatos ISO (YYYY-MM-DD), formato BR (DD/MM/AAAA) e strings combinadas.
 */
export function parseAppointmentDateTime(app: {
  date?: string;
  time?: string;
  dateTime?: string;
}): Date | null {
  try {
    // 1. Se tem data e hora isoladas no formato ISO (YYYY-MM-DD e HH:mm)
    if (app.date && /^\d{4}-\d{2}-\d{2}$/.test(app.date)) {
      const [y, m, d] = app.date.split('-').map(Number);
      let hours = 8;
      let minutes = 0;
      if (app.time) {
        const timeMatch = app.time.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
        }
      }
      return new Date(y, m - 1, d, hours, minutes, 0, 0);
    }

    // 2. Se tem data em formato DD/MM/AAAA
    if (app.date && /^\d{2}\/\d{2}\/\d{4}$/.test(app.date)) {
      const [d, m, y] = app.date.split('/').map(Number);
      let hours = 8;
      let minutes = 0;
      if (app.time) {
        const timeMatch = app.time.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
        }
      }
      return new Date(y, m - 1, d, hours, minutes, 0, 0);
    }

    // 3. Fallback no campo dateTime combinado (Ex: "06/11/2026 14:30" ou "2026-11-06 14:30")
    if (app.dateTime) {
      // Regex para DD/MM/AAAA HH:mm
      const brMatch = app.dateTime.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[^\d]*(\d{1,2}):(\d{2})/);
      if (brMatch) {
        const [, d, m, y, h, min] = brMatch.map(Number);
        return new Date(y, m - 1, d, h, min, 0, 0);
      }

      // Regex para YYYY-MM-DD HH:mm
      const isoMatch = app.dateTime.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[^\d]*(\d{1,2}):(\d{2})/);
      if (isoMatch) {
        const [, y, m, d, h, min] = isoMatch.map(Number);
        return new Date(y, m - 1, d, h, min, 0, 0);
      }

      // Tentativa direta com Date.parse
      const parsed = new Date(app.dateTime);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao interpretar data/hora do agendamento:', err);
  }
  return null;
}

/**
 * Calcula a data exata em que o lembrete de 24 horas antes deve ocorrer.
 */
export function calculateReminder24hTarget(serviceDate: Date): Date {
  return new Date(serviceDate.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Formata um objeto Date para visualização em Português.
 */
export function formatDateTimeDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} às ${h}:${min}`;
}

/**
 * Analisa o agendamento e retorna o status completo do lembrete de 24 horas.
 */
export function getAppointmentReminderAnalysis(
  app: CustomerAppointment,
  referenceNow: Date = new Date()
): ReminderAnalysis {
  // Se cancelado ou concluído, não há necessidade de lembrete
  if (app.status === 'Cancelado' || app.status === 'Concluído') {
    return {
      status: 'inactive',
      label: app.status === 'Concluído' ? 'Serviço Concluído' : 'Cancelado',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      hoursUntilService: 0,
      reminderTargetDate: null,
      serviceDate: null,
      canSendNow: false
    };
  }

  // Se já foi enviado
  if (app.reminder24hSent) {
    const sentDisplay = app.reminder24hSentAt 
      ? formatDateTimeDisplay(new Date(app.reminder24hSentAt))
      : 'Disparado';
    return {
      status: 'sent',
      label: `✅ Lembrete 24h Enviado (${sentDisplay})`,
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      hoursUntilService: 0,
      reminderTargetDate: null,
      serviceDate: null,
      canSendNow: false
    };
  }

  const serviceDate = parseAppointmentDateTime(app);
  if (!serviceDate) {
    return {
      status: 'scheduled',
      label: 'Data não informada',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      hoursUntilService: 999,
      reminderTargetDate: null,
      serviceDate: null,
      canSendNow: false
    };
  }

  const diffMs = serviceDate.getTime() - referenceNow.getTime();
  const hoursUntilService = diffMs / (1000 * 60 * 60);
  const reminderTargetDate = calculateReminder24hTarget(serviceDate);

  // Se a data do serviço já passou
  if (diffMs < 0) {
    return {
      status: 'past',
      label: 'Horário já ocorrido',
      badgeClass: 'bg-slate-800/80 text-slate-500 border-slate-700/50',
      hoursUntilService,
      reminderTargetDate,
      serviceDate,
      canSendNow: false
    };
  }

  // Se o serviço acontece nas próximas 24 horas (janela ideal de disparo do lembrete)
  if (hoursUntilService <= 24) {
    const hoursInt = Math.max(1, Math.round(hoursUntilService));
    return {
      status: 'due',
      label: `⏰ Lembrete 24h Pronto (Serviço em ~${hoursInt}h)`,
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
      hoursUntilService,
      reminderTargetDate,
      serviceDate,
      canSendNow: true
    };
  }

  // Se o serviço está a mais de 24 horas no futuro
  const hoursUntilReminder = Math.round(hoursUntilService - 24);
  const daysUntilReminder = Math.floor(hoursUntilReminder / 24);
  const timeDesc = daysUntilReminder > 0 
    ? `em ${daysUntilReminder}d` 
    : `em ${hoursUntilReminder}h`;

  return {
    status: 'scheduled',
    label: `🕒 Lembrete 24h agendado para ${formatDateTimeDisplay(reminderTargetDate)} (${timeDesc})`,
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    hoursUntilService,
    reminderTargetDate,
    serviceDate,
    canSendNow: false
  };
}

/**
 * Cria a mensagem personalizada e amigável para envio de lembrete no WhatsApp.
 */
export function buildReminderWhatsAppText(
  tenantName: string,
  app: CustomerAppointment,
  companyAddress?: string
): string {
  const addressText = app.addressSummary || companyAddress || 'nosso lava-jato';
  
  return (
    `*🔔 LEMBRETE DE AGENDAMENTO - ${tenantName.toUpperCase()}*\n\n` +
    `Olá, *${app.clientName}*! Tudo bem? 👋\n\n` +
    `Passando para lembrar que o seu serviço está agendado para amanhã:\n\n` +
    `📅 *Data e Horário:* ${app.dateTime}\n` +
    `🚗 *Veículo:* ${app.vehicle} (Placa: *${app.plate}*)\n` +
    `🧼 *Serviço:* ${app.service}\n` +
    `💰 *Valor:* R$ ${Number(app.price || 0).toFixed(2)}\n` +
    `📍 *Local:* ${addressText}\n\n` +
    `_Recomendamos chegar com 5 a 10 minutos de antecedência para agilizar a entrada do seu veículo no pátio._\n\n` +
    `Caso precise reagendar ou cancelar, basta responder a esta mensagem. Te aguardamos! ✨`
  );
}

/**
 * Gera URL direta para envio da mensagem pelo WhatsApp Web ou App.
 */
export function buildReminderWhatsAppUrl(
  phone: string | undefined,
  text: string
): string {
  if (!phone) {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }
  const clean = phone.replace(/\D/g, '');
  // Adiciona DDI 55 se não tiver
  const finalPhone = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Cria assunto e corpo prontos para envio de lembrete por E-mail.
 */
export function buildReminderEmailContent(
  tenantName: string,
  app: CustomerAppointment,
  companyAddress?: string
): { subject: string; body: string; mailtoUrl: string } {
  const subject = `⏰ Lembrete de Agendamento: Seu serviço é amanhã no ${tenantName}!`;
  const addressText = app.addressSummary || companyAddress || 'nosso lava-jato';

  const body = 
`Olá ${app.clientName},

Esperamos que esteja tendo um ótimo dia!

Este é um lembrete automático avisando que o seu veículo está agendado para amanhã:

• Data e Horário: ${app.dateTime}
• Veículo: ${app.vehicle} (Placa: ${app.plate})
• Serviço: ${app.service}
• Valor: R$ ${Number(app.price || 0).toFixed(2)}
• Local de Atendimento: ${addressText}

Por favor, chegue com alguns minutos de antecedência para agilizar o atendimento.

Se você precisar remarcar seu horário ou tiver alguma dúvida, entre em contato conosco respondendo a este e-mail.

Atenciosamente,
Equipe ${tenantName}`;

  const recipient = (app.clientEmail || '').trim();
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { subject, body, mailtoUrl };
}

/**
 * Gera link de adição rápida à Google Agenda com lembrete embutido.
 */
export function buildGoogleCalendarUrl(
  tenantName: string,
  app: CustomerAppointment
): string {
  const serviceDate = parseAppointmentDateTime(app);
  if (!serviceDate) return '';

  const endDate = new Date(serviceDate.getTime() + 60 * 60 * 1000); // 1 hora de duração padrão

  const formatIsoForGCal = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const startIso = formatIsoForGCal(serviceDate);
  const endIso = formatIsoForGCal(endDate);

  const title = encodeURIComponent(`Lava-Jato: ${app.service} (${app.vehicle})`);
  const details = encodeURIComponent(
    `Agendamento confirmado no ${tenantName}.\n` +
    `Veículo: ${app.vehicle} - Placa: ${app.plate}\n` +
    `Serviço: ${app.service}\n` +
    `Valor: R$ ${Number(app.price || 0).toFixed(2)}`
  );
  const location = encodeURIComponent(app.addressSummary || tenantName);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Gera conteúdo .ics (iCalendar) com alarme automático de 24 horas antes para Apple/Google/Outlook.
 */
export function generateIcsFileContent(
  tenantName: string,
  app: CustomerAppointment
): string {
  const serviceDate = parseAppointmentDateTime(app);
  if (!serviceDate) return '';

  const endDate = new Date(serviceDate.getTime() + 60 * 60 * 1000);

  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const startStr = formatIcsDate(serviceDate);
  const endStr = formatIcsDate(endDate);
  const nowStr = formatIcsDate(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WashAuto OS//Agendamentos//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:appointment-${app.id}@washauto.os`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:Lava-Jato: ${app.service} - ${app.vehicle}`,
    `DESCRIPTION:Agendamento de ${app.service} para o veículo ${app.vehicle} (${app.plate}) no ${tenantName}.`,
    `LOCATION:${app.addressSummary || tenantName}`,
    'STATUS:CONFIRMED',
    // Alarme automático 24 horas antes do evento
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: Seu serviço no lava-jato é amanhã às ${serviceDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}!`,
    'END:VALARM',
    // Alarme de reforço 1 hora antes
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete: Seu horário no lava-jato é daqui a 1 hora!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
