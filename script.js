document.addEventListener('DOMContentLoaded', () => {
    // --- CẤU HÌNH QUAN TRỌNG ---
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVejs5-MqJeQQ5vzJIWHy3JgJI1b8gfHJ6HRU7JWLlKv0PEFcoe9QiXUT4AOAaBGvmtQ/exec';
    const PASSWORD_KEY = 'attendanceAppPassword';

    // DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('password-input');
    const loginError = document.getElementById('login-error');
    const appContainer = document.getElementById('app-container');
    const statusIndicator = document.getElementById('status-indicator');
    const khoiSelect = document.getElementById('khoi-select');
    const lopSelect = document.getElementById('lop-select');
    const studentNameInput = document.getElementById('student-name');
    const addStudentBtn = document.getElementById('add-student');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    const chartContainer = document.getElementById('chart-container');
    const chartYAxis = document.getElementById('chart-y-axis');
    const scheduleSettingsBtn = document.getElementById('schedule-settings-btn');
    const scheduleModal = document.getElementById('schedule-modal');
    const closeScheduleModalBtn = document.getElementById('close-schedule-modal-btn');
    const scheduleDaysContainer = document.getElementById('schedule-days');
    const notePlaceholder = document.getElementById('note-placeholder');
    const noteEditor = document.getElementById('note-editor');
    const noteEditorDate = document.getElementById('note-editor-date');
    const lessonSelect = document.getElementById('lesson-select');
    const understandingSlider = document.getElementById('understanding-slider');
    const understandingValue = document.getElementById('understanding-value');
    const noteTextarea = document.getElementById('note-textarea');
    const saveNoteBtn = document.getElementById('save-note-btn');

    // State
    let password = '';
    let khoiList = [];
    let classConfigs = {};
    let selectedKhoi = '';
    let selectedLop = '';
    let students = [];
    let schedule = {};
    let lessons = [];
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    let debounceTimer;
    let selectedDay = { studentIndex: null, day: null };
    let isInitialized = false;

    // --- INITIALIZATION & LOGIN ---
    function main() {
        if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' || !SCRIPT_URL) {
            alert('Vui lòng cập nhật URL Google Apps Script trong file script.js!');
            return;
        }
        const savedPassword = sessionStorage.getItem(PASSWORD_KEY);
        if (savedPassword) {
            password = savedPassword;
            attemptLogin(true);
        } else {
            loginOverlay.classList.add('visible');
            passwordInput.focus();
            loginBtn.addEventListener('click', () => attemptLogin(false));
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') attemptLogin(false);
            });
        }
    }

    async function attemptLogin(isReload = false) {
        if (!isReload) {
            const inputPassword = passwordInput.value;
            if (!inputPassword) {
                loginError.textContent = 'Vui lòng nhập mật khẩu.';
                loginError.classList.remove('hidden');
                return;
            }
            password = inputPassword;
        }
        loginBtn.disabled = true;
        loginBtn.textContent = 'Đang đăng nhập...';
        loginError.classList.add('hidden');
        await loadInitialData();
    }

    // --- DATA HANDLING ---
    function showStatus(message, isError = false, duration = 2000) {
        statusIndicator.textContent = message;
        statusIndicator.style.backgroundColor = isError ? '#dc2626' : '#111827';
        statusIndicator.classList.add('show');
        setTimeout(() => statusIndicator.classList.remove('show'), duration);
    }

    async function loadInitialData() {
        showStatus('Đang tải cấu hình...');
        try {
            const response = await fetch(`${SCRIPT_URL}?password=${encodeURIComponent(password)}&action=getInitialData`);
            if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            sessionStorage.setItem(PASSWORD_KEY, password);
            loginOverlay.classList.remove('visible');
            appContainer.classList.remove('hidden');
            
            khoiList = data.khoiList || [];
            classConfigs = data.classConfigs || {};

            if (!isInitialized) {
                populateDateSelectors();
                populateScheduleModal();
                setupEventListeners();
                isInitialized = true;
            }

            populateKhoiSelect();
            showStatus('Tải cấu hình thành công!');
        } catch (error) {
            console.error('Không thể tải dữ liệu ban đầu:', error);
            showStatus('Lỗi tải cấu hình hoặc sai mật khẩu!', true, 5000);
            sessionStorage.removeItem(PASSWORD_KEY);
            loginOverlay.classList.add('visible');
            loginError.textContent = 'Mật khẩu không đúng hoặc có lỗi xảy ra.';
            loginError.classList.remove('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Đăng nhập';
        }
    }

    async function loadDataForClass() {
        if (!selectedKhoi || !selectedLop) {
            tableBody.innerHTML = `<tr><td colspan="33" class="text-center py-8 text-gray-500">Vui lòng chọn khối và lớp để xem dữ liệu.</td></tr>`;
            chartContainer.innerHTML = `<p class="w-full text-center text-gray-500">Biểu đồ sẽ hiển thị ở đây.</p>`;
            students = []; // Clear students array
            render();
            return;
        }
        showStatus('Đang tải dữ liệu lớp...');
        try {
            const response = await fetch(`${SCRIPT_URL}?password=${encodeURIComponent(password)}&action=getClassData&khoi=${encodeURIComponent(selectedKhoi)}&lop=${encodeURIComponent(selectedLop)}`);
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
            console.error('Không thể tải dữ liệu lớp:', error);
            showStatus('Lỗi khi tải dữ liệu lớp!', true, 5000);
        }
    }
    
    function saveDataToSheet() {
        if (!selectedKhoi || !selectedLop) return;
        clearTimeout(debounceTimer);
        showStatus('Đang lưu...');
        debounceTimer = setTimeout(async () => {
            const dataToSave = { password, khoi: selectedKhoi, lop: selectedLop, students, schedule };
            try {
                await fetch(SCRIPT_URL, {
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
        khoiSelect.addEventListener('change', handleKhoiChange);
        lopSelect.addEventListener('change', handleLopChange);
        addStudentBtn.addEventListener('click', addStudent);
        studentNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addStudent(); });
        monthSelect.addEventListener('change', () => { currentMonth = parseInt(monthSelect.value); render(); });
        yearSelect.addEventListener('change', () => { currentYear = parseInt(yearSelect.value); render(); });
        tableBody.addEventListener('click', handleTableClick);
        tableBody.addEventListener('change', handleCheckboxChange);
        scheduleSettingsBtn.addEventListener('click', () => scheduleModal.classList.add('visible'));
        closeScheduleModalBtn.addEventListener('click', () => {
            scheduleModal.classList.remove('visible');
            saveDataToSheet(); // Save schedule immediately
            render();
        });
        scheduleDaysContainer.addEventListener('change', updateSchedule);
        understandingSlider.addEventListener('input', () => {
            understandingValue.textContent = `${understandingSlider.value}%`;
        });
        saveNoteBtn.addEventListener('click', saveNote);
    }

    // --- UI & STATE HELPERS ---
    function populateKhoiSelect() {
        khoiSelect.innerHTML = '<option value="">-- Chọn Khối --</option>';
        khoiList.forEach(khoi => khoiSelect.add(new Option(khoi, khoi)));
        handleKhoiChange(); // Trigger to populate lopSelect
    }

    // --- UPDATED LOGIC ---
    function handleKhoiChange() {
        selectedKhoi = khoiSelect.value;
        lopSelect.innerHTML = '<option value="">-- Chọn Lớp --</option>'; // Reset dropdown
        if (!selectedKhoi) {
            selectedLop = '';
            loadDataForClass(); // Clear table if no grade is selected
            return;
        }

        // Trích xuất số từ tên khối (ví dụ: "5" từ "Khối 5")
        const gradeNumberMatch = selectedKhoi.match(/\d+/);
        if (!gradeNumberMatch) {
            lopSelect.innerHTML = '<option value="">-- Chưa có lớp --</option>';
            handleLopChange();
            return;
        }
        const gradeNumber = gradeNumberMatch[0];

        const availableLops = Object.keys(classConfigs);
        
        // Logic lọc lớp chính xác hơn: trích xuất số từ tên lớp và so sánh
        const filteredLops = availableLops.filter(lop => {
            const classNumberMatch = lop.match(/\d+/);
            if (!classNumberMatch) return false;
            
            // So sánh trực tiếp số của khối và số của lớp
            return classNumberMatch[0] === gradeNumber;
        });
        
        if (filteredLops.length > 0) {
            filteredLops.forEach(lop => lopSelect.add(new Option(lop, lop)));
            // Tự động chọn lớp đầu tiên trong danh sách đã lọc
            lopSelect.value = filteredLops[0]; 
        } else {
            lopSelect.innerHTML = '<option value="">-- Chưa có lớp --</option>';
        }
        // Tải dữ liệu cho lớp được chọn (hoặc xoá dữ liệu nếu không có lớp nào)
        handleLopChange();
    }


    function handleLopChange() {
        selectedLop = lopSelect.value;
        loadDataForClass();
    }

    function populateDateSelectors() {
        for (let i = 0; i < 12; i++) monthSelect.add(new Option(`Tháng ${i + 1}`, i));
        const startYear = new Date().getFullYear() - 5;
        for (let i = 0; i < 10; i++) yearSelect.add(new Option(startYear + i, startYear + i));
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;
    }

    function getDateKey(year, month, day) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
    }

    function populateScheduleModal() {
        dayNames.forEach((name, index) => {
            scheduleDaysContainer.innerHTML += `<div class="flex items-center"><input id="day-${index}" type="checkbox" data-day-index="${index}" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"><label for="day-${index}" class="ml-2 block text-sm text-gray-900">${name}</label></div>`;
        });
    }

    function updateScheduleCheckboxes() {
        for (let i = 0; i < 7; i++) {
            const checkbox = document.getElementById(`day-${i}`);
            if (checkbox) checkbox.checked = !!schedule[i];
        }
    }

    function populateLessonSelect() {
        lessonSelect.innerHTML = '';
        lessons.forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson;
            option.textContent = lesson;
            if(!lesson || lesson.toLowerCase().startsWith('chủ đề') || lesson.toLowerCase().startsWith('---') || lesson.trim() === '') {
                option.disabled = true;
                option.style.fontWeight = 'bold';
                option.style.backgroundColor = '#f3f4f6';
            }
            lessonSelect.appendChild(option);
        });
    }

    // --- CORE LOGIC & RENDERING ---
    function addStudent() {
        const name = studentNameInput.value.trim();
        if (name && !students.some(s => s.name === name)) {
            students.push({ name: name, attendance: {} });
            studentNameInput.value = '';
            renderAndSave();
        }
    }

    function deleteStudent(index) {
        if (confirm(`Bạn có chắc chắn muốn xóa học sinh "${students[index].name}"?`)) {
            students.splice(index, 1);
            if (selectedDay.studentIndex === index) {
                selectedDay = { studentIndex: null, day: null };
            }
            renderAndSave();
        }
    }

    function updateSchedule(e) {
        if (e.target.type === 'checkbox') {
            const dayIndex = e.target.dataset.dayIndex;
            schedule[dayIndex] = e.target.checked;
        }
    }

    function handleTableClick(e) {
        const cell = e.target.closest('.attendance-cell');
        if (cell) {
            const studentIndex = parseInt(cell.dataset.student);
            const day = parseInt(cell.dataset.day);
            selectedDay = { studentIndex, day };
            render();
        }
    }

    function handleCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const studentIndex = parseInt(e.target.dataset.student);
            const day = parseInt(e.target.dataset.day);
            const dateKey = getDateKey(currentYear, currentMonth, day);
            if (!students[studentIndex].attendance) students[studentIndex].attendance = {};
            let dayData = students[studentIndex].attendance[dateKey] || {};
            dayData.present = e.target.checked;
            students[studentIndex].attendance[dateKey] = dayData;
            renderAndSave();
        }
    }

    function displayNoteForSelectedDay() {
        const { studentIndex, day } = selectedDay;
        if (studentIndex === null || day === null || !students[studentIndex]) {
            noteEditor.classList.add('hidden');
            notePlaceholder.classList.remove('hidden');
            return;
        }

        const dateKey = getDateKey(currentYear, currentMonth, day);
        const student = students[studentIndex];
        const dayData = student.attendance[dateKey] || {};

        noteEditorDate.textContent = `Học sinh: ${student.name} - Ngày ${day}/${currentMonth + 1}/${currentYear}`;
        lessonSelect.value = dayData.lesson || lessons.find(l => l && !l.disabled) || '';
        understandingSlider.value = dayData.understanding || 50;
        understandingValue.textContent = `${understandingSlider.value}%`;
        noteTextarea.value = dayData.note || '';

        notePlaceholder.classList.add('hidden');
        noteEditor.classList.remove('hidden');
    }

    function saveNote() {
        const { studentIndex, day } = selectedDay;
        if (studentIndex === null || day === null) return;
        const dateKey = getDateKey(currentYear, currentMonth, day);
        if (!students[studentIndex].attendance) students[studentIndex].attendance = {};
        let dayData = students[studentIndex].attendance[dateKey] || {};

        dayData.lesson = lessonSelect.value;
        dayData.understanding = parseInt(understandingSlider.value);
        dayData.note = noteTextarea.value.trim();

        if (dayData.lesson || dayData.note) {
            dayData.present = true;
        }

        students[studentIndex].attendance[dateKey] = dayData;
        renderAndSave();
    }

    function render() {
        if (!selectedLop) return;
        renderTable();
        renderChart();
        displayNoteForSelectedDay();
    }
    
    function renderAndSave() {
        render();
        saveDataToSheet();
    }

    function renderTable() {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        tableHead.innerHTML = ''; tableBody.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th scope="col" class="px-6 py-3 sticky left-0 bg-gray-100 z-10 w-48">Học sinh</th>${Array.from({ length: daysInMonth }, (_, i) => `<th scope="col" class="px-4 py-3 text-center">${i + 1}</th>`).join('')}<th scope="col" class="px-6 py-3 text-center font-bold">Tổng</th>`;
        tableHead.appendChild(headerRow);
        if (students.length === 0) { tableBody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" class="text-center py-8 text-gray-500">Chưa có học sinh nào trong lớp này.</td></tr>`; return; }
        
        students.forEach((student, studentIndex) => {
            const row = document.createElement('tr'); row.className = 'hover:bg-gray-50';
            let totalDays = 0; let cells = '';
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = getDateKey(currentYear, currentMonth, day);
                const dayData = student.attendance ? student.attendance[dateKey] : null;
                const isChecked = dayData?.present || false;
                const hasNote = dayData && ((dayData.lesson && !lessons.find(l => l === dayData.lesson)?.disabled) || (dayData.note && dayData.note.trim() !== ''));
                const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
                const isTeachingDay = schedule[dayOfWeek];
                if (isChecked && isTeachingDay) totalDays++;
                
                const isSelected = selectedDay.studentIndex === studentIndex && selectedDay.day === day;
                const cellClasses = isTeachingDay ? 'attendance-cell' : 'non-teaching-day';
                const selectedClass = isSelected ? 'selected' : '';

                cells += `<td class="text-center p-2 ${cellClasses} ${selectedClass}" data-student="${studentIndex}" data-day="${day}"><div class="flex items-center justify-center"><input type="checkbox" class="custom-checkbox" data-student="${studentIndex}" data-day="${day}" ${isChecked ? 'checked' : ''} ${!isTeachingDay ? 'disabled' : ''}>${hasNote ? '<span class="note-indicator"></span>' : ''}</div></td>`;
            }
            const deleteButton = `<button onclick="window.deleteStudent(${studentIndex})" class="ml-2 text-red-500 hover:text-red-700 text-lg font-bold" title="Xóa học sinh">&times;</button>`;
            row.innerHTML = `<td class="px-6 py-4 font-medium text-gray-900 sticky left-0 bg-white z-10 w-48 flex items-center justify-between">${student.name} ${deleteButton}</td>${cells}<td class="px-6 py-4 text-center font-bold text-indigo-600">${totalDays}</td>`;
            tableBody.appendChild(row);
        });
    }

    function renderChart() {
        chartContainer.innerHTML = ''; chartYAxis.innerHTML = '';
        if (students.length === 0) { chartContainer.innerHTML = `<p class="w-full text-center text-gray-500">Biểu đồ sẽ hiển thị ở đây.</p>`; return; }
        let maxTeachingDays = 0; const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
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
                const dateKey = getDateKey(currentYear, currentMonth, day);
                if (student.attendance && student.attendance[dateKey]?.present && schedule[new Date(currentYear, currentMonth, day).getDay()]) totalDays++;
            }
            const barHeight = totalDays > 0 ? (totalDays / maxAttendance) * 100 : 0;
            const barColumn = document.createElement('div'); 
            barColumn.className = 'flex flex-col items-center flex-shrink-0 w-20 text-center z-10 h-full justify-end';
            
            barColumn.innerHTML = `
                <div class="bar-wrapper w-12 h-full relative flex items-end justify-center">
                    <div class="absolute left-1/2 -translate-x-1/2 font-bold text-indigo-600 pointer-events-none transition-opacity" 
                         style="bottom: calc(${barHeight}% + 0.25rem); opacity: ${totalDays > 0 ? 1 : 0};">
                        ${totalDays}
                    </div>
                    <div class="chart-bar w-full bg-gradient-to-t from-indigo-500 to-purple-600 hover:opacity-90 rounded-t-md" 
                         style="height: ${barHeight}%;">
                        <div class="tooltip">${student.name}: ${totalDays} buổi</div>
                    </div>
                </div>
                <div class="text-xs font-medium text-gray-600 mt-2 truncate w-full">${student.name}</div>
            `;
            chartContainer.appendChild(barColumn);
        });
    }
    
    window.deleteStudent = deleteStudent;
    main();
});
