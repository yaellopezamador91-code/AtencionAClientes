import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Desk { id: number; name: string; status: 'libre' | 'ocupada'; current_ticket: string | null; }
interface Ticket { code: string; customer: string; created_at?: string; desk_id?: number; status?: string; }
interface AppState { desks: Desk[]; queue: Ticket[]; current: Ticket[]; recent: Ticket[]; }

@Component({
  selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#inicio"><span class="brand-mark">t.</span><span>turnia<small>ATENCIÓN EN ORDEN</small></span></a>
        <div class="top-right"><span class="live-dot"></span> Sistema en vivo <span class="top-divider"></span><span>{{ today | date:'EEEE, d MMMM':'':'es' }}</span></div>
      </header>

      <main>
        <section class="welcome">
          <div><span class="eyebrow"><span class="spark">✳</span> CENTRO DE ATENCIÓN</span>
            <h1>Hola, equipo <span class="wave">✳</span></h1>
            <p>Todo listo para atender. Aquí tienes el pulso de tus mesas.</p>
          </div>
          <button class="primary new-ticket" (click)="showKiosk = !showKiosk"><span class="plus">＋</span> Tomar un turno</button>
        </section>

        <section class="stats" aria-label="Resumen de atención">
          <article class="stat-card"><span class="stat-icon purple">▤</span><div><span class="stat-label">EN ESPERA</span><strong>{{ state.queue.length }}</strong><small>clientes en fila</small></div><span class="stat-foot">↗</span></article>
          <article class="stat-card"><span class="stat-icon green">◉</span><div><span class="stat-label">MESAS LIBRES</span><strong>{{ freeDesks }}</strong><small>listas para atender</small></div><span class="stat-foot">✳</span></article>
          <article class="stat-card"><span class="stat-icon amber">◷</span><div><span class="stat-label">EN ATENCIÓN</span><strong>{{ state.current.length }}</strong><small>clientes siendo atendidos</small></div><span class="stat-foot">↗</span></article>
        </section>

        <section class="kiosk card" *ngIf="showKiosk">
          <div><span class="eyebrow">NUEVO TURNO</span><h2>¿Quién sigue?</h2><p>Escribe el nombre del cliente para agregarlo a la fila.</p></div>
          <form (ngSubmit)="takeTicket()"><input name="customer" [(ngModel)]="customer" placeholder="Nombre del cliente" maxlength="80" required><button class="primary" [disabled]="busy">{{ busy ? 'Guardando…' : 'Generar turno →' }}</button></form>
          <button class="close" aria-label="Cerrar" (click)="showKiosk=false">×</button>
        </section>
        <div class="toast" *ngIf="notice" [class.error]="isError">{{ notice }} <button (click)="notice=''">×</button></div>

        <section class="desk-section">
          <div class="section-heading"><div><span class="eyebrow">OPERACIÓN</span><h2>Mesas de atención <span class="count-pill">{{ state.desks.length }}</span></h2></div>
            <div class="legend"><span><i class="legend-dot available"></i> Disponible</span><span><i class="legend-dot busy-dot"></i> En atención</span></div>
          </div>
          <div class="desk-grid">
            <article class="desk-card" *ngFor="let desk of state.desks" [class.is-busy]="desk.status === 'ocupada'">
              <div class="desk-top"><span class="desk-icon">▦</span><span class="status" [class.occupied]="desk.status === 'ocupada'"><i></i>{{ desk.status === 'libre' ? 'Disponible' : 'En atención' }}</span></div>
              <div class="desk-title"><div><span class="desk-kicker">PUESTO DE SERVICIO</span><h3>{{ desk.name }}</h3></div><span class="desk-number">0{{ desk.id }}</span></div>
              <div class="current-box" *ngIf="desk.current_ticket; else noCurrent"><span>ATENDIENDO AHORA</span><div><strong>{{ desk.current_ticket }}</strong><small>{{ customerForDesk(desk) }}</small></div></div>
              <ng-template #noCurrent><div class="current-box empty-box"><span>ATENDIENDO AHORA</span><div><strong>—</strong><small>{{ desk.status === 'libre' ? 'Sin cliente asignado' : 'Ocupada manualmente' }}</small></div></div></ng-template>
              <div class="desk-actions"><button class="primary call-button" *ngIf="desk.status === 'libre'" [disabled]="busy || !state.queue.length" (click)="callNext(desk)">Llamar siguiente <span>→</span></button>
                <button class="secondary" *ngIf="desk.status === 'libre'" (click)="setDesk(desk, 'ocupada')">Marcar ocupada</button>
                <button class="secondary release" *ngIf="desk.status === 'ocupada'" (click)="setDesk(desk, 'libre')">{{ desk.current_ticket ? 'Finalizar atención' : 'Liberar mesa' }} <span>✓</span></button>
              </div>
            </article>
          </div>
        </section>

        <section class="bottom-grid">
          <article class="card queue-card"><div class="card-heading"><div><span class="eyebrow">PRÓXIMOS CLIENTES</span><h2>Fila de espera <span class="count-pill">{{ state.queue.length }}</span></h2></div><span class="queue-mark">≋</span></div>
            <div class="queue-list" *ngIf="state.queue.length; else emptyQueue"><div class="queue-row" *ngFor="let ticket of state.queue; let i = index"><span class="queue-position">{{ (i+1).toString().padStart(2,'0') }}</span><span class="avatar" [style.background]="avatarColor(i)">{{ initials(ticket.customer) }}</span><span class="queue-person"><strong>{{ ticket.customer }}</strong><small>En espera</small></span><span class="ticket-code">{{ ticket.code }}</span></div></div>
            <ng-template #emptyQueue><div class="empty-state"><span>✳</span><strong>La fila está tranquila</strong><small>Los nuevos turnos aparecerán aquí.</small></div></ng-template>
          </article>
          <article class="card activity-card"><div class="card-heading"><div><span class="eyebrow">LO QUE VA DEL DÍA</span><h2>Actividad reciente</h2></div><span class="activity-mark">↗</span></div>
            <div class="activity-list" *ngIf="state.recent.length; else emptyActivity"><div class="activity-row" *ngFor="let item of state.recent"><span class="activity-icon" [class.done]="item.status === 'finalizado'">{{ item.status === 'finalizado' ? '✓' : '◷' }}</span><span class="queue-person"><strong>{{ item.customer }}</strong><small>{{ item.status === 'finalizado' ? 'Atención finalizada' : 'Atención en curso' }} · Mesa {{ item.desk_id }}</small></span><span class="ticket-code">{{ item.code }}</span></div></div>
            <ng-template #emptyActivity><div class="empty-state"><span>◷</span><strong>Tu actividad aparecerá aquí</strong><small>En cuanto llames al primer turno.</small></div></ng-template>
          </article>
        </section>
        <footer><span>✳ <b>turnia</b> · Un turno a la vez, una sonrisa siempre.</span><span>Diseñado para atender mejor.</span></footer>
      </main>
    </div>
  `,
  styles: [`
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  state: AppState = { desks: [], queue: [], current: [], recent: [] };
  today = new Date(); customer = ''; showKiosk = false; busy = false; notice = ''; isError = false;
  private timer?: ReturnType<typeof setInterval>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  get freeDesks(): number { return this.state.desks.filter(d => d.status === 'libre').length; }
  ngOnInit(): void { this.refresh(); this.timer = setInterval(() => this.refresh(), 3000); }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); if (this.noticeTimer) clearTimeout(this.noticeTimer); }
  refresh(): void { this.http.get<AppState>('/api/state').subscribe({ next: s => this.state = s, error: () => this.flash('No se pudo conectar con el servidor. Revisa que el backend esté iniciado.', true) }); }
  takeTicket(): void {
    if (!this.customer.trim()) return;
    this.busy = true;
    this.http.post<Ticket>('/api/tickets', { customer: this.customer.trim() }).subscribe({
      next: ticket => { this.busy = false; this.customer = ''; this.showKiosk = false; this.flash(`¡Listo! El turno ${ticket.code} quedó en la fila.`); this.refresh(); },
      error: e => { this.busy = false; this.flash(e.error?.detail ?? 'No se pudo crear el turno.', true); },
    });
  }
  callNext(desk: Desk): void {
    this.busy = true;
    this.http.post<Ticket>(`/api/desks/${desk.id}/next`, {}).subscribe({
      next: ticket => { this.busy = false; this.flash(`Turno ${ticket.code}: favor de pasar a ${desk.name}.`); this.refresh(); },
      error: e => { this.busy = false; this.flash(e.error?.detail ?? 'No se pudo llamar al turno.', true); this.refresh(); },
    });
  }
  setDesk(desk: Desk, status: 'libre' | 'ocupada'): void {
    this.http.patch(`/api/desks/${desk.id}`, { status }).subscribe({
      next: () => { this.flash(status === 'libre' ? `${desk.name} quedó libre.` : `${desk.name} quedó ocupada.`); this.refresh(); },
      error: e => this.flash(e.error?.detail ?? 'No se pudo actualizar la mesa.', true),
    });
  }
  customerForDesk(desk: Desk): string { return this.state.current.find(t => t.desk_id === desk.id)?.customer ?? 'Cliente'; }
  initials(name: string): string { return name.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
  avatarColor(i: number): string { return ['#8970d6', '#d68c72', '#55a58a', '#6388ca', '#c27ca3'][i % 5]; }
  private flash(message: string, error = false): void {
    this.notice = message; this.isError = error;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice = '', 5000);
  }
}
