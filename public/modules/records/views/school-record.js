/* ================================================================
   Records Module — views/school-record.js
   생활기록부 (플레이스홀더)
   ================================================================ */

export function registerHandlers(RM) {}

export function renderSchoolRecord() {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📄 생활기록부 관리</h1>
      </div>
      <div class="form-body">
        <div style="text-align:center;padding:80px 20px">
          <div style="font-size:64px;margin-bottom:16px">📄</div>
          <h2 style="font-size:18px;font-weight:800;color:var(--text-primary);margin:0 0 8px">생활기록부 관리</h2>
          <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0 0 24px">
            생기부 PDF를 업로드하면<br>
            정율 AI가 분석하여 강점과 보완점을<br>
            알려드립니다.
          </p>
          <div style="padding:20px;border:2px dashed var(--border);border-radius:16px;color:var(--text-muted)">
            <i class="fas fa-cloud-upload-alt" style="font-size:32px;display:block;margin-bottom:8px"></i>
            <p style="font-size:14px;font-weight:600;margin:0">곧 출시 예정</p>
            <p style="font-size:12px;margin:4px 0 0">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
