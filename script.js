document.addEventListener('DOMContentLoaded', () => {
    // --- CẤU HÌNH QUAN TRỌNG ---
    // Dán URL Ứng dụng web từ Google Apps Script của bạn vào đây.
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVejs5-MqJeQQ5vzJIWHy3JgJI1b8gfHJ6HRU7JWLlKv0PEFcoe9QiXUT4AOAaBGvmtQ/exec'; 
    
    // DOM Elements
    const appContainer = document.getElementById('app-container');
    const statusIndicator = document.getElementById('status-indicator');
    const studentNameInput = document.getElementById('student-name');
    const addStudentBtn = document.getElementById('add-student');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    const chartContainer = document.getElementById('chart-container');
    const chartYAxis = document.getElementById('chart-y-axis');
    
    // Schedule Modal Elements
    const scheduleSettingsBtn = document.getElementById('schedule-settings-btn');
    const scheduleModal = document.getElementById('schedule-modal');
    const closeScheduleModalBtn = document.getElementById('close-schedule-modal-btn');
    const scheduleDaysContainer = document.getElementById('schedule-days');

    // Note Modal Elements
    const noteModal = document.getElementById('note-modal');
    const noteModalDate = document.getElementById('note-modal-date');
    const lessonSelect = document.getElementById('lesson-select');
    const understandingSlider = document.getElementById('understanding-slider');
    const understandingValue = document.getElementById('understanding-value');
    const noteTextarea = document.getElementById('note-textarea');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const cancelNoteBtn = document.getElementById('cancel-note-btn');

    // State
    let students = [];
    let schedule = {};
    let lessons = [];
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    let debounceTimer;
    let activeNote = { studentIndex: null, day: null };

    // --- INITIALIZATION ---
    function initializeApplication() {
        if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' || !SCRIPT_URL) {
            alert('Vui lòng cập nhật URL Google Apps Script trong file script.js!');
            return;
        }
        appContainer.style.display = 'block';
        populateDateSelectors();
        populateScheduleModal();
        setupEventListeners();
        loadDataFromSheet();
    }

    // --- DATA HANDLING WITH FETCH API ---
    function showStatus(message, isError = false, duration = 2000) {
        statusIndicator.textContent = message;
        statusIndicator.style.backgroundColor = isError ? '#dc2626' : '#111827';
        statusIndicator.classList.add('show');
        setTimeout(() => statusIndicator.classList.remove('show'), duration);
    }

    async function loadDataFromSheet() {
        showStatus('Đang tải dữ liệu...');
        try {
            const response = await fetch(SCRIPT_URL);
            if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            students = data.students || [];
            schedule = data.schedule || { 0: true, 1: false, 2: false, 3: false, 4: false, 5: false, 6: true };
            lessons = data.lessons || [];
            updateScheduleCheckboxes();
            populateLessonSelect();
            showStatus('Tải dữ liệu thành công!');
            render();
        } catch (error) {
            console.error('Không thể tải dữ liệu:', error);
            showStatus('Lỗi tải dữ liệu!', true, 5000);
        }
    }

    function saveDataToSheet() {
        clearTimeout(debounceTimer);
        showStatus('Đang lưu...');
        debounceTimer = setTimeout(async () => {
            const dataToSave = { students, schedule, lessons };
            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(dataToSave),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    mode: 'no-cors'
                });
                 showStatus('Đã lưu vào Google Sheet!');
            } catch (error) {
                console.error('Không thể lưu dữ liệu:', error);
                showStatus('Lỗi khi lưu!', true, 5000);
            }
        }, 1500);
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        addStudentBtn.addEventListener('click', addStudent);
        studentNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addStudent(); });
        monthSelect.addEventListener('change', updateDate);
        yearSelect.addEventListener('change', updateDate);
        tableBody.addEventListener('click', handleTableClick);
        tableBody.addEventListener('change', handleCheckboxChange);
        scheduleSettingsBtn.addEventListener('click', () => scheduleModal.classList.add('visible'));
        closeScheduleModalBtn.addEventListener('click', () => {
            scheduleModal.classList.remove('visible');
            renderAndSave();
        });
        scheduleDaysContainer.addEventListener('change', updateSchedule);
        understandingSlider.addEventListener('input', () => {
            understandingValue.textContent = `${understandingSlider.value}%`;
        });
        cancelNoteBtn.addEventListener('click', () => noteModal.classList.remove('visible'));
        saveNoteBtn.addEventListener('click', saveNote);
    }

    // --- UI & DATE HELPERS ---
    function populateDateSelectors() {
        for (let i = 0; i < 12; i++) monthSelect.add(new Option(`Tháng ${i + 1}`, i));
        const startYear = new Date().getFullYear() - 5;
        for (let i = 0; i < 10; i++) yearSelect.add(new Option(startYear + i, startYear + i));
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;
    }
    function getDaysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); }
    function populateScheduleModal() {
        dayNames.forEach((name, index) => {
            scheduleDaysContainer.innerHTML += `<div class="flex items-center"><input id="day-${index}" type="checkbox" data-day-index="${index}" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"><label for="day-${index}" class="ml-2 block text-sm text-gray-900">${name}</label></div>`;
        });
    }
    function updateScheduleCheckboxes() {
        for (let i = 0; i < 7; i++) {
            const checkbox = document.getElementById(`day-${i}`);
            if (checkbox) checkbox.checked = schedule[i];
        }
    }
    function populateLessonSelect() {
        lessonSelect.innerHTML = '';
        lessons.forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson;
            option.textContent = lesson;
            if(lesson.toLowerCase().startsWith('chủ đề') || lesson.toLowerCase().startsWith('---')) {
                option.disabled = true;
                option.style.fontWeight = 'bold';
                option.style.backgroundColor = '#f3f4f6';
            }
            lessonSelect.appendChild(option);
        });
    }

    // --- CORE LOGIC & RENDERING ---
    function renderAndSave() { render(); saveDataToSheet(); }
    function addStudent() { const name = studentNameInput.value.trim(); if (name && !students.some(s => s.name === name)) { students.push({ name: name, attendance: {} }); studentNameInput.value = ''; renderAndSave(); } }
    function deleteStudent(index) { if (confirm(`Bạn có chắc chắn muốn xóa học sinh "${students[index].name}"?`)) { students.splice(index, 1); renderAndSave(); } }
    function updateDate() { currentMonth = parseInt(monthSelect.value); currentYear = parseInt(yearSelect.value); render(); }
    function updateSchedule(e) { if (e.target.type === 'checkbox') { const dayIndex = e.target.dataset.dayIndex; schedule[dayIndex] = e.target.checked; } }
    
    function handleTableClick(e) {
        const cell = e.target.closest('.attendance-cell');
        if (cell && !e.target.matches('input[type="checkbox"]')) {
            const studentIndex = parseInt(cell.dataset.student);
            const day = parseInt(cell.dataset.day);
            openNoteModal(studentIndex, day);
        }
    }

    function handleCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const studentIndex = parseInt(e.target.dataset.student);
            const day = parseInt(e.target.dataset.day);
            const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
            if (!students[studentIndex].attendance) students[studentIndex].attendance = {};
            let dayData = students[studentIndex].attendance[dateKey] || {};
            dayData.present = e.target.checked;
            students[studentIndex].attendance[dateKey] = dayData;
            renderAndSave();
        }
    }
    
    function openNoteModal(studentIndex, day) {
        activeNote = { studentIndex, day };
        const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
        const student = students[studentIndex];
        const dayData = student.attendance[dateKey] || {};
        noteModalDate.textContent = `Học sinh: ${student.name} - Ngày ${day}/${currentMonth + 1}/${currentYear}`;
        lessonSelect.value = dayData.lesson || lessons[0];
        understandingSlider.value = dayData.understanding || 50;
        understandingValue.textContent = `${understandingSlider.value}%`;
        noteTextarea.value = dayData.note || '';
        noteModal.classList.add('visible');
    }

    function saveNote() {
        const { studentIndex, day } = activeNote;
        if (studentIndex === null || day === null) return;
        const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
        if (!students[studentIndex].attendance) students[studentIndex].attendance = {};
        let dayData = students[studentIndex].attendance[dateKey] || {};
        dayData.lesson = lessonSelect.value;
        dayData.understanding = parseInt(understandingSlider.value);
        dayData.note = noteTextarea.value;
        students[studentIndex].attendance[dateKey] = dayData;
        noteModal.classList.remove('visible');
        renderAndSave();
    }

    function render() { renderTable(); renderChart(); }
    
    function renderTable() {
        const daysInMonth = getDaysInMonth(currentMonth, currentYear);
        tableHead.innerHTML = ''; tableBody.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th scope="col" class="px-6 py-3 sticky left-0 bg-gray-100 z-10 w-48">Học sinh</th>${Array.from({ length: daysInMonth }, (_, i) => `<th scope="col" class="px-4 py-3 text-center">${i + 1}</th>`).join('')}<th scope="col" class="px-6 py-3 text-center font-bold">Tổng</th>`;
        tableHead.appendChild(headerRow);
        if (students.length === 0) { tableBody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" class="text-center py-8 text-gray-500">Chưa có học sinh nào.</td></tr>`; return; }
        
        students.forEach((student, studentIndex) => {
            const row = document.createElement('tr'); row.className = 'hover:bg-gray-50';
            let totalDays = 0; let cells = '';
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
                const dayData = student.attendance ? student.attendance[dateKey] : null;
                const isChecked = dayData?.present || false;
                const hasNote = dayData && (dayData.lesson || dayData.note);
                const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
                const isTeachingDay = schedule[dayOfWeek];
                if (isChecked && isTeachingDay) totalDays++;
                cells += `<td class="text-center p-2 ${!isTeachingDay ? 'non-teaching-day' : 'attendance-cell'}" data-student="${studentIndex}" data-day="${day}"><div class="flex items-center justify-center"><input type="checkbox" class="custom-checkbox" data-student="${studentIndex}" data-day="${day}" ${isChecked ? 'checked' : ''} ${!isTeachingDay ? 'disabled' : ''}>${hasNote ? '<span class="note-indicator"></span>' : ''}</div></td>`;
            }
            const deleteButton = `<button onclick="deleteStudent(${studentIndex})" class="ml-2 text-red-500 hover:text-red-700 text-lg font-bold" title="Xóa học sinh">&times;</button>`;
            row.innerHTML = `<td class="px-6 py-4 font-medium text-gray-900 sticky left-0 bg-white z-10 w-48 flex items-center justify-between">${student.name} ${deleteButton}</td>${cells}<td class="px-6 py-4 text-center font-bold text-indigo-600">${totalDays}</td>`;
            tableBody.appendChild(row);
        });
    }

    function renderChart() {
        chartContainer.innerHTML = ''; chartYAxis.innerHTML = '';
        if (students.length === 0) { chartContainer.innerHTML = `<p class="w-full text-center text-gray-500">Biểu đồ sẽ hiển thị ở đây.</p>`; return; }
        let maxTeachingDays = 0; const daysInMonth = getDaysInMonth(currentMonth, currentYear);
        for (let day = 1; day <= daysInMonth; day++) { if (schedule[new Date(currentYear, currentMonth, day).getDay()]) maxTeachingDays++; }
        const maxAttendance = Math.max(maxTeachingDays, 1);
        const gridLineCount = 5;
        for (let i = 0; i <= gridLineCount; i++) {
            const percentage = (i / gridLineCount) * 100;
            const attendanceValue = Math.round(maxAttendance * (percentage / 100));
            const yLabel = document.createElement('div'); yLabel.className = 'chart-y-axis-label'; yLabel.style.bottom = `${percentage}%`; yLabel.textContent = attendanceValue; chartYAxis.appendChild(yLabel);
            if (i > 0) { const line = document.createElement('div'); line.className = 'absolute left-0 right-0 border-t border-gray-200 border-dashed'; line.style.bottom = `${percentage}%`; line.style.zIndex = '0'; chartContainer.appendChild(line); }
        }
        students.forEach(student => {
            let totalDays = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
                if (student.attendance && student.attendance[dateKey]?.present && schedule[new Date(currentYear, currentMonth, day).getDay()]) totalDays++;
            }
            const barHeight = totalDays > 0 ? (totalDays / maxAttendance) * 100 : 0;
            const barColumn = document.createElement('div'); barColumn.className = 'flex flex-col items-center flex-shrink-0 w-20 text-center z-10 h-full justify-end';
            barColumn.innerHTML = `<div class="bar-wrapper w-12 h-full relative flex items-end justify-center"><div class="chart-bar w-full bg-gradient-to-t from-indigo-500 to-purple-600 hover:opacity-90 rounded-t-md" style="height: ${barHeight}%;"><div class="tooltip">${student.name}: ${totalDays} buổi</div><div class="absolute -top-6 left-1/2 -translate-x-1/2 font-bold text-indigo-600">${totalDays}</div></div></div><div class="text-xs font-medium text-gray-600 mt-2 truncate w-full">${student.name}</div>`;
            chartContainer.appendChild(barColumn);
        });
    }
    
    window.deleteStudent = deleteStudent;
    initializeApplication();
});
</script>
