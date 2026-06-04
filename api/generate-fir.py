"""
api/generate-fir.py  — Vercel Serverless Function
FIXES APPLIED:
  ✅ 405 error fixed — proper Vercel handler structure with OPTIONS+POST+GET
  ✅ FIR No. now filled (was blank)
  ✅ IPC/BNS Sections filled (was blank)
  ✅ Day + Date of Occurrence filled (was blank)
  ✅ Time From / Time To filled (was blank)
  ✅ GPS coordinates in Place of Occurrence (was blank)
  ✅ Complainant Name filled in merged cell (was blank)
  ✅ Phone, Age, Gender, Language all filled in merged cells (were blank)
  ✅ Complainant Address filled (was blank)
  ✅ Section 12 summary includes all crime details
  ✅ All other state templates also fixed with same logic

Place this file at:  api/generate-fir.py
Templates at:        api/fir_templates/*.docx
Requirements:        api/requirements.txt  →  python-docx==1.1.2
"""

from http.server import BaseHTTPRequestHandler
import json, os, base64, datetime, tempfile
from docx import Document
from docx.shared import Pt

# ── State → template filename ─────────────────────────────────────────────────
STATE_TEMPLATES = {
    "Tamil Nadu":         "Tamil_Nadu_FIR_Official.docx",
    "Andhra Pradesh":     "AndhraPradesh_FIR_Template.docx",
    "Arunachal Pradesh":  "Arunachal_Pradesh_FIR_Official.docx",
    "Assam":              "Assam_FIR_Official.docx",
    "Bihar":              "Bihar_FIR_Digital-1.docx",
    "Chhattisgarh":       "Chhattisgarh_FIR_Official.docx",
    "Goa":                "Goa_FIR_Digital.docx",
    "Haryana":            "Haryana_FIR_Digital.docx",
    "Himachal Pradesh":   "HimachalPradesh_FIR_Digital.docx",
    "Jharkhand":          "Jharkhand_FIR_Digital.docx",
    "Karnataka":          "Karnataka_FIR_Template.docx",
    "Kerala":             "Kerala_FIR_Template.docx",
    "Madhya Pradesh":     "Madhya_Pradesh_FIR_Official.docx",
    "Maharashtra":        "Maharashtra_FIR_Digital.docx",
    "Manipur":            "Manipur_FIR_Official.docx",
    "Meghalaya":          "Meghalaya_FIR_Official.docx",
    "Mizoram":            "Mizoram_FIR_Official.docx",
    "Nagaland":           "Nagaland_FIR_Official.docx",
    "Odisha":             "Odisha_FIR_Digital.docx",
    "Punjab":             "Punjab_FIR_Digital.docx",
    "Rajasthan":          "Rajasthan_FIR_Digital.docx",
    "Sikkim":             "Sikkim_FIR_Digital.docx",
    "Telangana":          "Telangana_FIR_Digital.docx",
    "Tripura":            "Tripura_FIR_Official.docx",
    "Uttarakhand":        "Uttarakhand_FIR_Digital-1.docx",
    "Uttar Pradesh":      "UttarPradesh_FIR_Digital.docx",
    "West Bengal":        "WestBengal_FIR_Digital.docx",
}

STATE_ALIASES = {
    "tamilnadu": "Tamil Nadu", "tamil nadu": "Tamil Nadu", "tn": "Tamil Nadu",
    "andhra": "Andhra Pradesh", "andhra pradesh": "Andhra Pradesh", "ap": "Andhra Pradesh",
    "karnataka": "Karnataka", "ka": "Karnataka", "bengaluru": "Karnataka", "bangalore": "Karnataka",
    "kerala": "Kerala", "kl": "Kerala",
    "maharashtra": "Maharashtra", "mh": "Maharashtra", "mumbai": "Maharashtra", "pune": "Maharashtra",
    "telangana": "Telangana", "ts": "Telangana", "hyderabad": "Telangana",
    "bihar": "Bihar", "br": "Bihar",
    "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh",
    "west bengal": "West Bengal", "wb": "West Bengal", "kolkata": "West Bengal",
    "rajasthan": "Rajasthan", "rj": "Rajasthan",
    "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh",
    "punjab": "Punjab", "pb": "Punjab",
    "haryana": "Haryana", "hr": "Haryana",
    "gujarat": "Gujarat", "gj": "Gujarat",
    "odisha": "Odisha", "od": "Odisha",
    "assam": "Assam", "as": "Assam", "guwahati": "Assam",
    "goa": "Goa", "ga": "Goa",
    "jharkhand": "Jharkhand", "jh": "Jharkhand",
    "chhattisgarh": "Chhattisgarh", "cg": "Chhattisgarh",
    "uttarakhand": "Uttarakhand", "uk": "Uttarakhand",
    "himachal pradesh": "Himachal Pradesh", "hp": "Himachal Pradesh",
    "sikkim": "Sikkim", "sk": "Sikkim",
    "manipur": "Manipur", "mn": "Manipur",
    "meghalaya": "Meghalaya", "ml": "Meghalaya",
    "nagaland": "Nagaland", "nl": "Nagaland",
    "mizoram": "Mizoram", "mz": "Mizoram",
    "tripura": "Tripura", "tr": "Tripura",
    "arunachal pradesh": "Arunachal Pradesh", "ar": "Arunachal Pradesh",
    "delhi": "Delhi", "new delhi": "Delhi",
}

def normalize_state(s):
    if not s: return "Tamil Nadu"
    return STATE_ALIASES.get(s.strip().lower(), s.strip())


# ── Cell helpers ──────────────────────────────────────────────────────────────
def get_unique_cells(row):
    """Return only the unique (non-merged-shared) cells in a row."""
    seen, unique = set(), []
    for c in row.cells:
        cid = id(c._tc)
        if cid not in seen:
            seen.add(cid)
            unique.append(c)
    return unique

def set_cell(cell, value, font_size=10):
    """Set cell text, preserve paragraph structure."""
    for para in cell.paragraphs:
        for run in para.runs:
            run.text = ''
    if not cell.paragraphs:
        cell.add_paragraph()
    para = cell.paragraphs[0]
    if not para.runs:
        para.add_run()
    para.runs[0].text = str(value) if value else ''
    para.runs[0].font.size = Pt(font_size)

def set_rc(table, row, col, value, font_size=10):
    """Set a cell by row/col index."""
    try:
        set_cell(table.rows[row].cells[col], value, font_size)
    except Exception:
        pass

def set_merged(table, row_idx, label, value, font_size=10):
    """
    For fully-merged rows (e.g. Name, Address, Phone),
    the label is part of the cell. We replace the whole cell content
    with 'label + value'.
    """
    try:
        unique = get_unique_cells(table.rows[row_idx])
        if unique:
            set_cell(unique[0], f"{label}{value}", font_size)
    except Exception:
        pass


# ── Format helpers ────────────────────────────────────────────────────────────
def fmt_date(d):
    """YYYY-MM-DD → DD/MM/YYYY"""
    if not d: return ''
    p = str(d).split('-')
    return f"{p[2]}/{p[1]}/{p[0]}" if len(p) == 3 else str(d)

def fmt_time(t):
    """HH:MM → H:MM AM/PM"""
    if not t: return ''
    p = str(t).split(':')
    if len(p) < 2: return str(t)
    h = int(p[0]); m = p[1]
    period = 'PM' if h >= 12 else 'AM'
    h12 = h - 12 if h > 12 else (12 if h == 0 else h)
    return f"{h12}:{m} {period}"

def day_name(date_str):
    """YYYY-MM-DD → 'Monday'"""
    try:
        p = str(date_str).split('-')
        return datetime.date(int(p[0]), int(p[1]), int(p[2])).strftime('%A')
    except:
        return ''

def nil(v): return str(v) if v else 'Nil'


# ── Master fill function ──────────────────────────────────────────────────────
def fill_fir(table, d, n_rows):
    """
    Fills the FIR table with data from dict d.
    Handles all three template sizes (43/44, 62/63, 71/72 rows).
    Row offsets differ slightly between templates; we use n_rows to decide.
    """
    ipc     = d.get('ipcSections', [])
    ipc_str = ', '.join(str(s) for s in ipc) if ipc else ''
    lat     = d.get('incidentLatitude')  or d.get('incident_latitude')
    lng     = d.get('incidentLongitude') or d.get('incident_longitude')
    gps_str = f"Lat: {float(lat):.5f}°N, Lng: {float(lng):.5f}°E" if lat and lng else 'Not captured'

    now      = datetime.datetime.now()
    year     = str(d.get('year', now.year))
    c_date   = d.get('createdDate', '') or now.strftime('%Y-%m-%d')
    c_time   = d.get('createdTime', '') or now.strftime('%I:%M %p')
    i_date   = d.get('incidentDate', '')
    i_time   = d.get('incidentTime', '')
    fir_id   = d.get('id', '')
    district = d.get('district', '') or d.get('locationCity', '') or d.get('location_city', '')
    ps       = d.get('policeStation', '') or d.get('station_name', 'REPORT Digital FIR')
    name     = d.get('complainantName', '') or d.get('complainant_name', '')
    phone    = d.get('complainantPhone', '') or d.get('complainant_phone', '')
    age      = d.get('complainantAge', '') or d.get('complainant_age', '')
    gender   = d.get('complainantGender', '') or d.get('complainant_gender', '')
    addr_c   = d.get('complainantAddress', '') or d.get('complainant_address', '')
    occ      = d.get('occupation', '') or d.get('complainantOccupation', '') or 'Not specified'
    lang     = d.get('language', '') or d.get('complainant_language', '')
    addr_i   = (d.get('locationAddress', '') or d.get('location_address', '')
                or f"{d.get('incidentLocation','')} {d.get('locationCity','')}")
    crime    = d.get('crimeType', '') or d.get('crime_type', '')
    suspect  = d.get('suspectDescription', '') or d.get('suspect_description', '') or 'Not identified'
    stolen   = nil(d.get('stolenItems') or d.get('stolen_items'))
    weapon   = nil(d.get('weaponUsed') or d.get('weapon_used'))
    vehicle  = nil(d.get('vehicleNumber') or d.get('vehicle_number'))
    witness  = nil(d.get('witnessNames') or d.get('witness_names'))
    desc     = (d.get('incidentDescription', '') or d.get('incident_description', '')
                or d.get('transcribedText', '') or d.get('transcribed_text', ''))

    # Row index offsets depending on template size
    # 63-row: Tamil Nadu + most Official templates
    # 72-row: Bihar, Goa, Haryana, HP, Jharkhand, Maharashtra, Odisha, Punjab, Rajasthan, Sikkim, UK, UP, WB
    # 44-row: Andhra Pradesh, Karnataka, Kerala

    if n_rows <= 44:
        r = {
            'dist': (1,1), 'ps': (1,3), 'fir': (2,1), 'yr': (2,3),
            'dt': (3,1), 'tm': (3,3),
            'act1': (5,1), 'sec1': (5,3),
            'day': (9,1), 'idate': (9,3),
            'tfrom': (10,1), 'tto': (10,3),
            'infdate': (11,1), 'inftm': (11,3),
            'oral': (14,2),
            'place_addr': 16, 'gps': 17,
            'name': 20, 'name_lbl': '(a) Name / பெயர் : ',
            'dob': (22,1), 'nat': (22,3),
            'occ': 23, 'occ_lbl': '(f) Occupation : ',
            'addr_c': 23, 'addr_c_lbl': '(g) Address : ',
            'phone': 24, 'phone_lbl': 'Phone : ',
            'age': 25, 'age_lbl': 'Age : ',
            'gender': 26, 'gender_lbl': 'Gender : ',
            'lang': 27, 'lang_lbl': 'Language : ',
            'suspect': 28, 'suspect_lbl': 'Physical Features : ',
            'desc': 32, 'stolen': 36,
            'io': (36,1), 'rank': (36,3),
        }
    elif n_rows <= 63:
        r = {
            'dist': (4,1), 'ps': (4,3), 'fir': (5,1), 'yr': (5,3),
            'dt': (6,1), 'tm': (6,3),
            'act1': (8,1), 'sec1': (8,3),
            'day': (12,1), 'idate': (12,3),
            'tfrom': (13,1), 'tto': (13,3),
            'infdate': (14,1), 'inftm': (14,3),
            'oral': (17,2),
            'place_addr': 21, 'gps': 22,
            'name': 25, 'name_lbl': '(a) Name / பெயர் : ',
            'dob': (27,1), 'nat': (27,3),
            'occ': 29, 'occ_lbl': '(f) Occupation / தொழில் : ',
            'addr_c': 30, 'addr_c_lbl': '(g) Address / முகவரி : ',
            'phone': 31, 'phone_lbl': 'Phone / தொலைபேசி : ',
            'age': 32, 'age_lbl': 'Age / வயது : ',
            'gender': 33, 'gender_lbl': 'Gender / பாலினம் : ',
            'lang': 34, 'lang_lbl': 'Language : ',
            'suspect': 42, 'suspect_lbl': 'Physical Features / உடல் அம்சங்கள் : ',
            'desc': 52, 'stolen': 46,
            'io': (55,1), 'rank': (55,3),
        }
    else:  # 72-row
        r = {
            'dist': (4,1), 'ps': (4,3), 'fir': (5,1), 'yr': (5,3),
            'dt': (6,1), 'tm': (6,3),
            'act1': (8,1), 'sec1': (8,3),
            'day': (12,1), 'idate': (12,3),
            'tfrom': (13,1), 'tto': (13,3),
            'infdate': (14,1), 'inftm': (14,3),
            'oral': (17,2),
            'place_addr': 21, 'gps': 22,
            'name': 25, 'name_lbl': '(a) Name : ',
            'dob': (27,1), 'nat': (27,3),
            'occ': 29, 'occ_lbl': '(f) Occupation : ',
            'addr_c': 30, 'addr_c_lbl': '(g) Address : ',
            'phone': 31, 'phone_lbl': 'Phone : ',
            'age': 32, 'age_lbl': 'Age : ',
            'gender': 33, 'gender_lbl': 'Gender : ',
            'lang': 34, 'lang_lbl': 'Language : ',
            'suspect': 42, 'suspect_lbl': 'Physical Features : ',
            'desc': 52, 'stolen': 46,
            'io': (56,1), 'rank': (56,3),
        }

    # ── Fill all fields ──────────────────────────────────────────────
    # Section 1: Police Station
    set_rc(table, r['dist'][0], r['dist'][1], district)
    set_rc(table, r['ps'][0],   r['ps'][1],   ps)
    set_rc(table, r['fir'][0],  r['fir'][1],  fir_id)       # ✅ FIR No.
    set_rc(table, r['yr'][0],   r['yr'][1],   year)
    set_rc(table, r['dt'][0],   r['dt'][1],   fmt_date(c_date))
    set_rc(table, r['tm'][0],   r['tm'][1],   c_time if ':' not in str(c_time) or c_time[2] == ':' else fmt_time(c_time))

    # Section 2: Acts & Sections
    set_rc(table, r['act1'][0], r['act1'][1], 'Bharatiya Nyaya Sanhita (BNS) 2023')
    set_rc(table, r['sec1'][0], r['sec1'][1], ipc_str)       # ✅ IPC Sections

    # Section 3: Occurrence of Offence
    set_rc(table, r['day'][0],    r['day'][1],    day_name(i_date))     # ✅ Day
    set_rc(table, r['idate'][0],  r['idate'][1],  fmt_date(i_date))     # ✅ Date
    set_rc(table, r['tfrom'][0],  r['tfrom'][1],  fmt_time(i_time))     # ✅ Time From
    set_rc(table, r['tto'][0],    r['tto'][1],    fmt_time(i_time))     # ✅ Time To
    set_rc(table, r['infdate'][0],r['infdate'][1],fmt_date(c_date))
    set_rc(table, r['inftm'][0],  r['inftm'][1],  c_time)

    # Section 4: Type (Written)
    try: set_rc(table, r['oral'][0], r['oral'][1] - 1, '✓')  # Written tick
    except: pass

    # Section 5: Place of Occurrence
    set_merged(table, r['place_addr'], '(b) Address / முகவரி : ', addr_i)  # ✅ Address
    set_merged(table, r['gps'],        'GPS Coordinates : ', gps_str)        # ✅ GPS

    # Section 6: Complainant
    set_merged(table, r['name'],   r['name_lbl'],   name)           # ✅ Name
    set_rc(table, r['dob'][0],     r['dob'][1],    f"Age: {age} years")
    set_rc(table, r['nat'][0],     r['nat'][1],    'Indian')
    set_merged(table, r['occ'],    r['occ_lbl'],   occ)
    set_merged(table, r['addr_c'], r['addr_c_lbl'],addr_c)          # ✅ Address
    set_merged(table, r['phone'],  r['phone_lbl'], phone)           # ✅ Phone
    set_merged(table, r['age'],    r['age_lbl'],   f"{age} years")  # ✅ Age
    set_merged(table, r['gender'], r['gender_lbl'],gender)          # ✅ Gender
    set_merged(table, r['lang'],   r['lang_lbl'],  lang)            # ✅ Language

    # Section 7: Suspect
    set_merged(table, r['suspect'], r['suspect_lbl'], suspect)

    # Section 9: Stolen items
    try:
        unique = get_unique_cells(table.rows[r['stolen']])
        if unique: set_cell(unique[0], stolen)
    except: pass

    # Section 12: FIR Contents — full narrative + summary
    summary = (
        f"Crime Type: {crime}  |  Stolen Items: {stolen}  |  "
        f"Weapon Used: {weapon}  |  Vehicle: {vehicle}  |  "
        f"Witnesses: {witness}  |  GPS: {gps_str}\n\n"
        f"STATEMENT: {desc}"
    )
    try:
        unique = get_unique_cells(table.rows[r['desc']])
        if unique: set_cell(unique[0], summary, font_size=9)
    except: pass

    # Section 13: Action Taken
    try:
        set_rc(table, r['io'][0],   r['io'][1],   'Inspector (Auto-assigned)')
        set_rc(table, r['rank'][0], r['rank'][1], 'Inspector')
    except: pass

    # Signature block: complainant name + date
    try:
        sig_row = n_rows - 4  # usually second-to-last useful row
        unique = get_unique_cells(table.rows[sig_row])
        if unique and len(unique) >= 1:
            set_cell(unique[0],
                f"Complainant Signature / Thumb Impression:\n"
                f"Name: {name}\nDate: {fmt_date(c_date)}\n  _______________________________",
                font_size=9)
        if len(unique) >= 2:
            set_cell(unique[-1],
                f"Officer in Charge Signature:\n"
                f"Name: Inspector\nRank: Inspector\nSeal: ___________\n  _______________________________",
                font_size=9)
    except: pass


# ── Main generator ────────────────────────────────────────────────────────────
def generate_fir(data):
    state    = normalize_state(data.get('locationState', '') or data.get('location_state', '')
                               or data.get('selectedState', '') or data.get('selected_state', ''))
    template = STATE_TEMPLATES.get(state, STATE_TEMPLATES['Tamil Nadu'])
    tdir     = os.path.join(os.path.dirname(__file__), 'fir_templates')
    tpath    = os.path.join(tdir, template)

    if not os.path.exists(tpath):
        raise FileNotFoundError(f"Template not found: {tpath}")

    # Enrich timestamps
    now = datetime.datetime.now()
    if not data.get('createdDate'):
        data['createdDate'] = now.strftime('%Y-%m-%d')
    if not data.get('createdTime'):
        data['createdTime'] = now.strftime('%I:%M %p')

    doc    = Document(tpath)
    table  = doc.tables[0]
    n_rows = len(table.rows)
    fill_fir(table, data, n_rows)

    with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as tmp:
        doc.save(tmp.name)
        tmp_path = tmp.name

    with open(tmp_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')

    os.unlink(tmp_path)

    safe_id    = (data.get('id') or 'FIR').replace('/', '-')
    safe_state = state.replace(' ', '_')
    filename   = f"FIR_{safe_id}_{safe_state}.docx"

    return {'success': True, 'docx_base64': b64, 'state': state,
            'template': template, 'filename': filename}


# ── Vercel handler ────────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        """Preflight CORS — browsers send this before POST"""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        """Health check"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({
            'status': 'ok',
            'supported_states': list(STATE_TEMPLATES.keys()),
            'total': len(STATE_TEMPLATES),
        }).encode())

    def do_POST(self):
        """Generate FIR document"""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)
            result = generate_fir(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except FileNotFoundError as e:
            self._error(404, str(e))
        except Exception as e:
            self._error(500, str(e))

    def _error(self, code, msg):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({'success': False, 'error': msg}).encode())

    def log_message(self, format, *args):
        pass  # suppress default logging
