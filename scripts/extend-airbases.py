"""Add a reviewed ICAO subset from an OurAirports CSV; preserve existing records.
Usage: python scripts/extend-airbases.py /path/to/airports.csv
Public navigation records only; inclusion is not an operational suitability check.
"""
import csv, hashlib, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader(source.open()))
by_code = {r['ident']: r for r in rows}
# Explicit inclusion, not an automatic military-name classifier. Excludes known
# former bases, closed facilities, helipads and non-ICAO local identifiers.
codes = '''EBBE EBBL EBBX EBCV EBFN EBFS EBMB EBSL EBSU EBUL EBWE
EGDR EGDW EGDY EGOQ EGOS EGOW EGQS EGUB EGUL EGUN EGVA EGVN EGVO EGWC EGWU EGXC EGXE EGXT EGXW EGXY EGXZ EGYD EGYE EGYM
EHDL EHGR EHKD EHLW EHVK EHWO EIME EKKA EKSP EFUT
EPCE EPDA EPDE EPIR EPKS EPLK EPLY EPMB EPMI EPMM EPOK EPPR EPPW EPSN EPTM
ESCF ESCM ESIA ESIB ESPE
ETHB ETHL ETHN ETHS ETMN ETND ETNG ETNH ETNN ETNS ETNT ETNW ETSB ETSH ETSL ETSN
LAKV LBPG LBPL LEAB LEGA LEGT LEMO LERI LETO
LFPV LFMY LFQP LFQE LFRJ LFRL LFXA LFYR
LGAD LGEL LGLR LGMG LGTG LGTP LHKE LHPA LHSN
LIBA LIBN LIBV LICZ LIED LIMN LIPA LIPC LIPI LIPL LIPS LIRE LIRG LIRL LIRM LIRS
LJCE LKCV LKKB LKNA LOXA LOXT LOXZ LPAR LPBJ LPMR LPMT LPOV LPST LPTN LRCT
LSMA LSMD LSME LSMM LSMP LYBT LZMC LZPW LCRA'''.split()
joint = set('LFRH LFTH LDZD LDZA LZSL ENOL ENBO ENAN ENNA EFJY EFTP EFRO EFKU LCPH'.split())
p = root/'data/international-airbases.json'
data = json.loads(p.read_text())
existing = {a['icao'] for a in data['airbases']} | {a['icao'] for a in json.loads((root/'data/navdata.json').read_text())['airports']}
added=[]
for code in sorted(set(codes)|joint):
    if code in existing: continue
    r=by_code[code]
    assert r['type'] in ('small_airport','medium_airport','large_airport')
    if not r['elevation_ft'] or not (r['icao_code']==code or r['gps_code']==code):
        print('Skipped unconfirmed code/elevation:',code); continue
    a=dict(icao=code,name=r['name'],city=r['municipality'],country=r['iso_country'],elevationFt=float(r['elevation_ft']),lat=float(r['latitude_deg']),lon=float(r['longitude_deg']),category='Zivil-militärisch' if code in joint else 'Militärflugplatz',facility='CIV-MIL' if code in joint else 'MIL',source='OurAirports (public domain)',sourceStatus='OPEN DATA',sourceUrl='https://ourairports.com/airports/'+code+'/',dataCheckedAt='2026-10-20')
    if code=='LFPV':
        a.update(lat=48+46/60+27/3600,lon=2+11/60+29/3600,elevationFt=585,source='SIA France AIP AD 2 LFPV.2 (10 JUL 2025)',sourceStatus='AIP REFERENCE',officialReference='SIA France AIP AD 2 LFPV.2',sourceUrl='https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_16_APR_2026/FRANCE/AIRAC-2026-04-16/pdf/FR-AD-2.LFPV-fr-FR.pdf',sourceNote='ARP and elevation use the published AIP reference rather than the differing OurAirports coordinates/584 ft. No operational availability implied.')
    data['airbases'].append(a);added.append(code)
data['meta'].update(version='2026-10-20',dataSource='Existing airportsdata records retained; European additions from OurAirports public-domain CSV. LFPV ARP/elevation from SIA France AIP AD 2 LFPV.2.',extensionSource={'url':'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv','retrievedAt':'2026-10-20','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'selection':'Explicit ICAO list in scripts/extend-airbases.py. Not an exhaustive inventory; no operational availability or runway suitability validation.'})
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Added',len(added),'airbases:', ' '.join(added))
