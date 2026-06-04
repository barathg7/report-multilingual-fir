import { Shield, Printer } from "lucide-react";
import Button from "@/components/ui/Button";
import DigitalSignature from "./DigitalSignature";

export default function FIRDocument({ fir, officerName = "Inspector", onAllSigned }) {
  const signatures = { complainant: null, officer: null };
  const checkAllSigned = (role, data) => {
    signatures[role] = data;
    if (signatures.complainant && signatures.officer) onAllSigned?.(signatures);
  };

  const Field = ({ label, value }) => {
    if (!value) return null;
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 font-medium break-words">{value}</p>
      </div>
    );
  };

  const Section = ({ title, titleTa, children }) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-700">{title}</p>
        {titleTa && <p className="text-xs text-gray-500">{titleTa}</p>}
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div id="fir-doc" className="bg-white border border-gray-300 rounded-xl overflow-hidden text-sm">

        {/* Header */}
        <div className="text-center bg-blue-700 text-white px-4 py-5">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Government of Tamil Nadu</p>
          <h1 className="text-lg font-extrabold mt-1">FIRST INFORMATION REPORT</h1>
          <p className="text-xs opacity-75 mt-0.5">முதல் தகவல் அறிக்கை (தமிழ்நாடு காவல்துறை)</p>
          <div className="inline-flex items-center gap-2 mt-3 bg-white/20 rounded-full px-4 py-1.5">
            <Shield className="h-4 w-4" />
            <span className="font-mono text-sm font-bold">{fir?.id || "FIR/TN001/2026/0001"}</span>
          </div>
        </div>

        <div className="p-4 space-y-3">

          {/* Station & Dates */}
          <Section title="FIR Details" titleTa="புகார் விவரங்கள்">
            <div className="grid grid-cols-1 gap-0">
              <Field label="Police Station" value={fir?.stationName || "Chennai Central PS"} />
              <Field label="Investigating Officer" value={officerName} />
              <Field label="Date of Report" value={fir?.createdAt
                ? new Date(fir.createdAt).toLocaleDateString("en-IN", { dateStyle: "full" })
                : new Date().toLocaleDateString("en-IN", { dateStyle: "full" })} />
              <Field label="Date of Incident" value={fir?.incidentDate} />
              <Field label="Time of Incident" value={fir?.incidentTime} />
            </div>
          </Section>

          {/* Complainant */}
          <Section title="Complainant Details" titleTa="புகார்தாரர் விவரங்கள்">
            <Field label="Full Name" value={fir?.complainantName} />
            <Field label="Age" value={fir?.complainantAge} />
            <Field label="Gender" value={fir?.complainantGender} />
            <Field label="Phone" value={fir?.complainantPhone} />
            <Field label="Address" value={fir?.complainantAddress} />
            <Field label="Language" value={fir?.language} />
          </Section>

          {/* Incident */}
          <Section title="Incident Details" titleTa="சம்பவ விவரங்கள்">
            <Field label="Crime Type" value={fir?.crimeType} />
            <Field label="Location" value={fir?.incidentLocation} />
            {fir?.incidentLatitude && (
              <div className="py-2 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">GPS Coordinates</p>
                <p className="text-sm text-gray-800 font-mono">{fir.incidentLatitude.toFixed(6)}, {fir.incidentLongitude.toFixed(6)}</p>
              </div>
            )}
            <Field label="Location Address" value={fir?.locationAddress || fir?.locationRoad} />
            <Field label="Landmarks" value={fir?.locationLandmarks} />
            <Field label="Stolen Items" value={fir?.stolenItems} />
            <Field label="Weapon Used" value={fir?.weaponUsed} />
            <Field label="Vehicle Number" value={fir?.vehicleNumber} />
            <Field label="Witness Names" value={fir?.witnessNames} />
            <div className="py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Statement / புகார்</p>
              <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-lg border border-gray-200 p-3">
                {fir?.incidentDescription || fir?.transcribedText || "—"}
              </p>
            </div>
          </Section>

          {/* Suspect */}
          {fir?.suspectDescription && (
            <Section title="Suspect Description" titleTa="சந்தேகநபர் விவரம்">
              <div className="py-2">
                <p className="text-sm text-gray-800 leading-relaxed">{fir.suspectDescription}</p>
              </div>
              {fir?.suspectSketchUrl && (
                <div className="pb-3">
                  <p className="text-xs text-gray-500 mb-2">AI Sketch (investigative reference only):</p>
                  <img src={fir.suspectSketchUrl} alt="Suspect Sketch" className="w-full max-w-xs rounded-lg border border-gray-200" />
                </div>
              )}
            </Section>
          )}

          {/* IPC */}
          {fir?.ipcSections?.length > 0 && (
            <Section title="BNS Sections Applied (Bharatiya Nyaya Sanhita 2023)" titleTa="பயன்படுத்தப்பட்ட சட்டப்பிரிவுகள் (BNS 2023)">
              <div className="py-2 flex flex-wrap gap-2">
                {fir.ipcSections.map(s => (
                  <span key={s} className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                    BNS §{s}
                  </span>
                ))}
              </div>
              {fir?.ipcValidated && (
                <p className="text-xs text-green-600 pb-2">✅ Verified against BNS 2023 reference database</p>
              )}
            </Section>
          )}

          {/* Evidence */}
          {(fir?.evidencePhotos?.length > 0 || fir?.suspectSketchUrl) && (
            <Section title="Evidence Attached" titleTa="இணைக்கப்பட்ட ஆதாரங்கள்">
              {fir?.evidencePhotos?.length > 0 && (
                <Field label="Photos" value={`${fir.evidencePhotos.length} photo(s) attached`} />
              )}
              {fir?.suspectSketchUrl && (
                <Field label="Sketch" value="AI suspect sketch generated — investigative reference only" />
              )}
            </Section>
          )}

          {/* Signatures */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Official Signatures / கையொப்பங்கள்</p>
            <DigitalSignature
              label="Complainant Signature"
              signerName={fir?.complainantName}
              signerRole="Complainant"
              onSign={d => checkAllSigned("complainant", d)}
            />
            <DigitalSignature
              label="Investigating Officer Signature"
              signerName={officerName}
              signerRole="Investigating Officer"
              onSign={d => checkAllSigned("officer", d)}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 text-center">
            <p className="text-xs text-gray-400">Generated by REPORT — AI-Powered Multilingual FIR System</p>
            <p className="text-xs text-gray-400 mt-0.5">Tamil Nadu Police · BNS 2023 · Digital signatures valid under IT Act 2000</p>
            <p className="text-xs text-red-500 mt-0.5 font-medium">CONFIDENTIAL OFFICIAL DOCUMENT</p>
          </div>
        </div>
      </div>

      {/* Print button */}
      <Button variant="outline" full onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / Save FIR
      </Button>
    </div>
  );
}