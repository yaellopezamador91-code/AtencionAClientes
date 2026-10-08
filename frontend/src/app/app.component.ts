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
    :host{display:block;min-height:100vh;color:#24232b}.shell{max-width:1240px;margin:auto;padding:0 44px}.topbar{height:78px;border-bottom:1px solid #e9e8ec;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;gap:10px;align-items:center;text-decoration:none;color:#262333;font-size:21px;font-weight:800;letter-spacing:-1px}.brand-mark{display:grid;place-items:center;background:#7457d8;color:#fff;border-radius:11px;width:34px;height:34px;font-size:23px;font-weight:600}.brand small{display:block;color:#9994a4;font-size:8px;letter-spacing:1.35px;margin-top:1px}.top-right{display:flex;align-items:center;gap:9px;font-size:12px;color:#777382}.live-dot{width:7px;height:7px;background:#50bf86;border-radius:50%;box-shadow:0 0 0 3px #e5f5ed}.top-divider{height:16px;width:1px;background:#e5e3e9;margin:0 7px}.welcome{display:flex;justify-content:space-between;align-items:end;padding:37px 0 28px}.eyebrow{font-size:9px;font-weight:800;letter-spacing:1.25px;color:#9792a2}.spark{color:#8063df;margin-right:5px}.welcome h1{font-size:32px;letter-spacing:-1.3px;line-height:1.14;margin:9px 0 8px}.wave{font-size:21px;color:#e5a740}.welcome p,.kiosk p{color:#898593;margin:0;font-size:13px}.primary{background:#7659d8;color:white;border:0;border-radius:9px;padding:11px 16px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 5px 12px #7659d822;transition:.18s}.primary:hover{background:#6446c8;transform:translateY(-1px)}.primary:disabled{opacity:.43;cursor:not-allowed;transform:none}.new-ticket{padding:13px 18px}.plus{font-size:17px;margin-right:6px;vertical-align:-1px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.stat-card{background:#fff;border:1px solid #ebe9ee;border-radius:13px;padding:16px 18px;display:flex;align-items:center;gap:13px;position:relative;box-shadow:0 2px 6px #25213005}.stat-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:20px}.purple{background:#f0ebfc;color:#8063df}.green{background:#e9f7ef;color:#43ab73}.amber{background:#fff4e4;color:#d79434}.stat-card>div{display:grid;gap:2px}.stat-label{font-size:9px;letter-spacing:1px;color:#898594;font-weight:800}.stat-card strong{font-size:23px;line-height:1.1;letter-spacing:-.5px}.stat-card small{font-size:10px;color:#9995a1}.stat-foot{margin-left:auto;align-self:start;color:#c8c4d0;font-size:16px}.desk-section{padding-top:33px}.section-heading,.card-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:14px}.section-heading h2,.card-heading h2,.kiosk h2{margin:5px 0 0;font-size:19px;letter-spacing:-.55px}.count-pill{display:inline-grid;place-items:center;min-width:21px;height:21px;border-radius:7px;background:#efecf8;color:#795cda;font-size:10px;vertical-align:2px;margin-left:4px}.legend{display:flex;gap:17px;font-size:10px;color:#85818e;padding-bottom:3px}.legend>span{display:flex;align-items:center;gap:6px}.legend-dot{width:7px;height:7px;border-radius:50%}.available{background:#4ebc82}.busy-dot{background:#efaa4d}.desk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.desk-card{background:white;border:1px solid #e9e7ed;border-radius:13px;padding:16px;min-width:0;transition:.2s}.desk-card:hover{border-color:#d4c8f6;box-shadow:0 7px 22px #3c27670a}.desk-card.is-busy{background:#fefeff}.desk-top{display:flex;justify-content:space-between;align-items:center}.desk-icon{color:#8170b7;font-size:18px}.status{display:flex;align-items:center;gap:6px;border-radius:20px;background:#ebf7f0;color:#319864;padding:5px 8px;font-size:9px;font-weight:700}.status i{width:6px;height:6px;border-radius:50%;background:#48b67b}.status.occupied{background:#fff3e4;color:#c28329}.status.occupied i{background:#e6a249}.desk-title{display:flex;align-items:center;justify-content:space-between;padding:15px 0 12px}.desk-kicker{font-size:8px;letter-spacing:1px;color:#aaa6b1;font-weight:700}.desk-title h3{margin:4px 0 0;font-size:16px;letter-spacing:-.3px}.desk-number{font-size:25px;font-weight:800;color:#eeecf1;letter-spacing:-1px}.current-box{background:#f7f5fb;border:1px solid #f0edf6;border-radius:9px;padding:10px 11px;min-height:61px}.current-box>span{font-size:8px;font-weight:800;letter-spacing:.85px;color:#9994a4}.current-box>div{display:flex;align-items:center;gap:8px;margin-top:5px}.current-box strong{color:#7659d8;font-size:15px}.current-box small{font-size:10px;color:#6e6a77;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty-box strong{color:#cbc7d1}.empty-box small{color:#aaa6b0}.desk-actions{display:flex;gap:7px;margin-top:11px}.desk-actions button{font-size:10px;padding:9px 8px;white-space:nowrap}.call-button{flex:1;display:flex;justify-content:space-between;align-items:center}.call-button span{font-size:15px;line-height:8px}.secondary{border:1px solid #e7e4ec;background:white;color:#716d7a;border-radius:8px;cursor:pointer;padding:9px 8px;font-weight:700;font-size:10px}.secondary:hover{border-color:#bfb1eb;color:#684bc8}.release{width:100%;color:#50886a}.release span{margin-left:5px}.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:27px}.card{background:white;border:1px solid #e9e7ed;border-radius:13px;padding:18px}.card-heading{align-items:center;margin-bottom:12px}.card-heading h2{font-size:16px}.queue-mark,.activity-mark{width:32px;height:32px;border-radius:10px;background:#f1edfb;display:grid;place-items:center;color:#856be0;font-size:18px}.activity-mark{background:#eaf6ef;color:#56a675}.queue-row,.activity-row{display:flex;align-items:center;gap:10px;border-top:1px solid #f0eef2;padding:9px 1px}.queue-position{width:18px;color:#aaa6b1;font-size:9px;font-weight:700}.avatar{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;color:#fff;font-size:9px;font-weight:800}.queue-person{display:grid;gap:3px;min-width:0;flex:1}.queue-person strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-person small{font-size:9px;color:#aaa6b1}.ticket-code{font-size:10px;color:#7659d8;background:#f4f1fb;padding:5px 8px;border-radius:6px;font-weight:800}.activity-icon{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:#fff4e5;color:#d59740;font-size:12px}.activity-icon.done{background:#eaf6ef;color:#45a36d}.empty-state{height:126px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#aaa6b1;gap:7px}.empty-state>span{font-size:19px;color:#c5b8eb}.empty-state strong{font-size:11px;color:#777380}.empty-state small{font-size:10px}footer{display:flex;justify-content:space-between;padding:24px 1px 25px;font-size:9px;color:#aaa6b1}footer b{color:#6c637e}.kiosk{position:relative;display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:14px;border-color:#dcd3f3;background:#fcfbff}.kiosk h2{font-size:16px}.kiosk p{font-size:11px;margin-top:4px}.kiosk form{display:flex;gap:8px;flex:1;max-width:490px}.kiosk input{flex:1;min-width:100px;border:1px solid #e5e1eb;border-radius:8px;padding:10px 12px;font:inherit;font-size:11px;outline:none}.kiosk input:focus{border-color:#9c86e6}.kiosk .close{align-self:flex-start;border:0;background:transparent;color:#999;cursor:pointer;font-size:17px}.toast{position:fixed;z-index:5;bottom:20px;left:50%;transform:translateX(-50%);background:#302b3b;color:white;padding:12px 18px;border-radius:9px;box-shadow:0 8px 28px #0002;font-size:12px}.toast.error{background:#a84646}.toast button{border:0;background:none;color:white;margin-left:12px;cursor:pointer}@media(max-width:900px){.shell{padding:0 25px}.desk-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.shell{padding:0 16px}.topbar{height:65px}.top-right{font-size:0}.top-right .live-dot{font-size:0}.top-divider{display:none}.welcome{align-items:flex-start;gap:12px;flex-direction:column;padding:28px 0 20px}.welcome h1{font-size:27px}.stats{gap:8px}.stat-card{padding:12px 9px;gap:8px;align-items:flex-start}.stat-icon{width:30px;height:30px;font-size:16px;border-radius:9px}.stat-label{font-size:7px}.stat-card strong{font-size:20px}.stat-card small{font-size:8px}.stat-foot{display:none}.section-heading{align-items:flex-start;gap:10px;flex-direction:column}.legend{padding:0}.desk-grid{gap:9px}.desk-card{padding:12px}.desk-actions{flex-direction:column}.desk-actions button{width:100%}.bottom-grid{grid-template-columns:1fr;gap:11px;margin-top:19px}.kiosk{align-items:stretch;flex-direction:column;padding:15px}.kiosk .close{position:absolute;right:12px;top:8px}footer span:last-child{display:none}}
  `,
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
