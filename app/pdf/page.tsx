"use client";
import * as XLSX from "xlsx";
import React, { useState, useEffect, useMemo } from "react";

import ECGSignalChart from "@/components/ECGSignalChart";
import HeartRateChart from "@/components/HeartRateChart";
import axios from "axios";

const API_BASE_URL = "https://api.staging.v2.pulz.ai/api";
const API_TOKEN = ""; // Replace with your actual token

const getAuthHeaders = () => ({
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    // Add any other required headers here
});

const fetchSession = async (pid: string): Promise<SessionData[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/client/sessions?subjectId=${pid}`, {
            headers: getAuthHeaders()
        });
        return response?.data?.data;
    } catch (error) {
        console.error('Error fetching session data:', error);
        throw error;
    }
};

const fetchSinglePatient = async (patientId: string): Promise<any> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/client/subjects/${patientId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching patient data:', error);
        throw error;
    }
};

export const fetchTenantList = async (): Promise<any> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/client/tenant`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        throw error;
    }
};


interface PatientData {
    dateOfBirth: string;
    externalId: string;
    firstName: string;
    lastName: string;
    gender: string;
    // Add other patient properties as needed
}

interface SessionData {
    id: string;
    createdAt: string;
    // Add other session properties as needed
}

interface PdfContentProps {
    selectedChannel?: number;
    sid?: string; // Session ID to filter by
}

const PdfContent = ({
    selectedChannel = 1,
}: PdfContentProps) => {
    const sid = "jd82044a";

    const [patientsData, setPatientsData] = useState<PatientData | null>(null);
    const [tenantList, setTenantList] = useState<any | null>(null);
    const [heartRateData, setHeartRateData] = useState<number[]>([]);
    const [sessionSummary, setSessionSummary] = useState<any>(null);
    const [channel1Charts, setChannel1Charts] = useState<number[][]>([]);
    const [channel2Charts, setChannel2Charts] = useState<number[][]>([]);
    const [calculatedOverallScore, setCalculatedOverallScore] =
        useState<number>(0);
    const [sessionsData, setSessionsData] = useState<SessionData[]>([]);
    const selectedSession = useMemo(() => {
        if (!sessionsData || !sid) return null;
        return sessionsData?.find(session => session.id === sid);
    }, [sessionsData, sid]);

    const address = tenantList?.tenant?.address

    useEffect(() => {
        const loadData = async () => {
            try {
                const tenantList = await fetchTenantList();
                setTenantList(tenantList);

                // Fetch session data
                const sessions = await fetchSession("37a0064e");
                setSessionsData(sessions);

                const patientData = await fetchSinglePatient("37a0064e");
                setPatientsData(patientData);

            } catch (err) {
                console.error('Error loading data:', err);
            } finally {
            }
        };

        loadData();
    }, []);

    const patientAge = () => {
        if (!patientsData?.dateOfBirth) return 'N/A';

        const today = new Date();
        const birthDate = new Date(patientsData.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const month = today.getMonth() - birthDate.getMonth();
        if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
            age -= 1;
        }
        return age;
    };

    const pad2 = (n: number) =>
        String(Math.max(0, Math.floor(n ?? 0))).padStart(2, "0");
    const formatTime = (m?: number, s?: number) =>
        `${pad2(m ?? 0)}:${pad2(s ?? 0)} Minutes`;

    const getNeedleRotation = (score: number) => {
        const s = Math.min(Math.max(score, 0), 100);
        if (s <= 40) return -90 + (s / 45) * 80;
        if (s <= 60) return -10 + ((s - 30) / 30) * 40;
        return 30 + ((s - 60) / 40) * 60;
    };

    const getScoreDescription = (score: number) => {
        if (score < 25) {
            return (
                <p style={{ display: 'inline' }}>A PulzCAD<sup style={{ fontSize: '10px' }}>™</sup>  Score of 25 or below suggests the patient is mostly showing signs of a normal stress ECG, indicating  minimal to no signs of stress-induced ischemia and CAD. Please also correlate clinically with other factors.</p>
            );
        }
        if (score <= 35) {
            return (
                <p style={{ display: 'inline' }}>
                    A PulzCAD<sup style={{ fontSize: '10px' }}>™</sup>  Score between 25 and 35 indicates that the patient is showing borderline tendencies, testing positive for stress induced cardiac ischemia with some of the stress ECG parameters. This could be an indication of early CAD conditions.Please also correlate clinically with other factors.
                </p>
            );
        }
        return (
            <p style={{ display: 'inline' }}>A PulzCAD<sup style={{ fontSize: '10px' }}>™</sup> Score above 35 indicates the patient is expressing strong signs of stress induced ischemia possibly caused by CAD. Higher the score, higher the probability of severity of CAD. A follow-up test as determined appropriate by the consulting cardiologist is recommended. Please also correlate clinically with other factors.</p>);
    };

    // ---------------- LOAD XLSX ----------------
    useEffect(() => {
        const loadHRProfile = async () => {
            try {
                const response = await fetch("/sessionReport.xlsx");
                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: "array" });

                // HR Sheet
                const sheet = workbook.Sheets["HR Profile"];
                if (sheet) {
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
                    const c1: number[] = [];
                    const c2: number[] = [];
                    rows.slice(1).forEach((r) => {
                        if (Number(r[1])) c1.push(Number(r[1]));
                        if (Number(r[2])) c2.push(Number(r[2]));
                    });
                    setHeartRateData(selectedChannel === 1 ? c1 : c2);
                }

                // Session Summary
                const ss = workbook.Sheets["Session Summary"];
                if (ss) {
                    const r = XLSX.utils.sheet_to_json(ss, { header: 1 }) as any[];
                    const head = r[0];
                    const row = r[1];
                    const get = (key: string) =>
                        Number(row[head.indexOf(key)]) || 0;

                    setSessionSummary({
                        durationMins: get("DurationMins"),
                        durationSecs: get("DurationSecs"),
                        restingHR: get("RestingHR"),
                        peakHR: get("PeakHR"),
                        endHR: get("EndHR"),
                        timeOfPeakMins: get("TimeOfPeak_Mins"),
                        timeOfPeakSecs: get("TimeOfPeak_Secs"),
                    });
                }

                // Extract ECG charts
                const extractFourColumns = (ws?: XLSX.WorkSheet): number[][] => {
                    if (!ws) return [];

                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number)[][];
                    if (!rows || rows.length === 0) return [];

                    const headers = (rows[0] || []).map((h) => String(h || "").trim());
                    const idxOf = (name: string) =>
                        headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

                    let indices = ["HR1", "HR2", "HR3", "HR4"].map(idxOf);

                    if (indices.every((i) => i < 0)) {
                        indices = [0, 1, 2, 3];
                    }

                    const series: number[][] = indices.map(() => []);

                    rows.slice(1).forEach((row) => {
                        indices.forEach((ci, k) => {
                            const val = Number(row[ci]);
                            if (Number.isFinite(val)) series[k].push(val);
                        });
                    });

                    return series;
                };

                setChannel1Charts(extractFourColumns(workbook.Sheets["Channel 1"]));
                setChannel2Charts(extractFourColumns(workbook.Sheets["Channel 2"]));

                // Average Score
                const scoreSheet = workbook.Sheets["Scores"];
                if (scoreSheet) {
                    const r = XLSX.utils.sheet_to_json(scoreSheet, { header: 1 }) as any[];
                    const headers = r[0];
                    const row = r[1];

                    const scoreCols = headers
                        .map((h: string, i: number) =>
                            h.toLowerCase().includes("score") ? i : -1
                        )
                        .filter((i: number) => i !== -1);

                    const scores = scoreCols
                        .map((i: number) => Number(row[i]))
                        .filter((v: number) => !isNaN(v));

                    setCalculatedOverallScore(
                        Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
                    );
                }
            } catch (e) {
                console.error("Excel Load Error", e);
            }
        };

        loadHRProfile();
    }, [selectedChannel]);

    // ---------------- COMPONENTS ----------------

    const Header = () => (
        <div className="flex justify-between items-center bg-[#ECF9FF] px-[30px] py-4">
            <div>
                <img src="/assets/sessionReportLogo.png" className="w-[124px] h-[26px]" />
                <p className="text-sm font-bold">Stress ECG Report</p>
            </div>
            <p className="font-semibold text-[16px] text-right">{tenantList?.tenant?.name}</p>
        </div>
    );

    const PatientDetail = () => (
        <div className="border border-gray-300 mt-2.5 py-2.5 px-3.5 text-[12px]">
            <div className="grid grid-cols-3 mb-1.5">
                <p>
                    Date of Test:{" "}
                    <span className="font-bold">
                        {selectedSession?.createdAt
                            ? new Date(selectedSession.createdAt).toISOString().split("T")[0]
                            : "N/A"}
                    </span>
                </p>
                <p>
                    Session ID: <span className="font-bold">{selectedSession?.id}</span>
                </p>
                <p>
                    Patient ID:{" "}
                    <span className="font-bold">{patientsData?.externalId}</span>
                </p>
            </div>

            <div className="grid grid-cols-3">
                <p>
                    Name:{" "}
                    <span className="font-bold">
                        {patientsData?.firstName} {patientsData?.lastName}
                    </span>
                </p>
                <p>
                    Gender: <span className="font-bold">{patientsData?.gender}</span>
                </p>
                <p>
                    Age: <span className="font-bold">{patientAge()} years</span>
                </p>
            </div>
        </div>
    );

    const Footer = () => (
        <footer className="bg-[#F3FBFF] px-8 pt-[14px] pb-4 mt-auto">
            <div className="grid grid-cols-12 text-black text-[10px]">
                <div className="col-span-7 pr-4 font-semibold leading-tight">
                    <b>Disclaimer:</b> LoremLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
                </div>

                <div className="col-span-5 border-l pl-2.5 flex flex-col gap-2">
                    <div className="flex items-start">
                        <img src="/icons/location.svg" className="w-3 h-3 mr-2 mt-0.5" />
                        <p className="leading-snug font-medium">
                            {[
                                address?.line1 ?? "",
                                address?.line2 ?? "",
                                address?.city ?? "",
                                address?.state ?? "",
                                address?.country ?? "",
                                address?.postCode ?? "",
                            ]
                                .filter(item => item && item.trim() !== "")
                                .join(", ")}
                        </p>
                    </div>

                    <div className="flex items-center">
                        <img src="/icons/phone.svg" className="w-3 h-3 mr-2" />
                        <p className="font-semibold"> {tenantList?.tenant?.phone} &nbsp; | &nbsp; {tenantList?.tenant?.phone}</p>
                    </div>
                </div>
            </div>
        </footer>
    );

    return (
        <div className="w-[595px] bg-white text-black font-sans">
            {/* ---------------- PAGE 1 ---------------- */}
            <div className="h-[842px] flex flex-col print:page-break-after">
                <Header />

                <div className="px-7 mb-3">
                    <PatientDetail />

                    {/* SUMMARY + SCORE */}
                    <div className="grid grid-cols-12 gap-2.5 mt-2.5 min-h-[290px]">
                        {/* LEFT */}
                        <div className="col-span-7 border border-gray-300 rounded">
                            <div className="bg-[#E5E5E5] py-2 px-3 font-semibold text-[13px] border-b border-gray-300">
                                Report Summary
                            </div>

                            <div className="p-3 text-[12px] leading-6">
                                {getScoreDescription(calculatedOverallScore)}
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="col-span-5 flex flex-col gap-2.5">
                            <div className="border border-gray-300 rounded p-4 flex flex-col items-center justify-center">
                                <p className="text-[22px]">SCORE</p>
                                <p className="text-[50px] font-bold">{calculatedOverallScore}</p>
                            </div>

                            <div className="border border-gray-300 rounded relative flex justify-center py-6 px-5">
                                <img src="/assets/speedometer.png" className="w-full" />
                                <img
                                    src="/assets/needle.png"
                                    className="h-[47px] absolute bottom-6 origin-[50%_85%]"
                                    style={{
                                        left: "50%",
                                        transform: `translateX(-50%) rotate(${getNeedleRotation(
                                            calculatedOverallScore
                                        )}deg)`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* HR + SESSION SUMMARY */}
                    <div className="grid grid-cols-12 gap-2.5 mt-2.5 max-h-[300px]">
                        {/* HR Profile */}
                        <div className="col-span-7 border border-gray-300 rounded">
                            <div className="bg-[#E5E5E5] py-2 px-3 font-semibold text-[13px] border-b border-gray-300">
                                Session Heart Rate Profile
                            </div>

                            <div className="h-full">
                                <HeartRateChart
                                    data={heartRateData}
                                />
                            </div>
                        </div>

                        {/* SESSION SUMMARY */}
                        <div className="col-span-5 border border-gray-300 rounded text-[12px]">
                            <div className="bg-[#E5E5E5] py-2 px-3 font-semibold text-[13px] border-b border-gray-300">
                                Session Summary
                            </div>

                            <div className="p-3">
                                <p className="mt-1">
                                    Total Duration:
                                    <br />
                                    <b>
                                        {sessionSummary
                                            ? formatTime(
                                                sessionSummary.durationMins,
                                                sessionSummary.durationSecs
                                            )
                                            : "-"}
                                    </b>
                                </p>

                                <p className="mt-3">
                                    Target Heart Rate:
                                    <br />
                                    <b>{sessionSummary?.restingHR} bpm</b>
                                </p>

                                <p className="mt-3">
                                    Peak Heart Rate:
                                    <br />
                                    <b>
                                        {sessionSummary?.peakHR} bpm (
                                        {formatTime(
                                            sessionSummary?.timeOfPeakMins,
                                            sessionSummary?.timeOfPeakSecs
                                        )}
                                        )
                                    </b>
                                </p>

                                <p className="mt-3">
                                    Resting Heart Rate:
                                    <br />
                                    <b>{sessionSummary?.restingHR} bpm</b>
                                </p>

                                <p className="mt-3">
                                    End Heart Rate:
                                    <br />
                                    <b>{sessionSummary?.endHR} bpm</b>
                                </p>

                            </div>
                        </div>
                    </div>
                </div>

                <Footer />
            </div>

            {/* ---------------- PAGE 2 ---------------- */}
            <div className="h-[842px] flex flex-col print:page-break-after">
                <Header />

                <div className="px-7">
                    <PatientDetail />

                    <div className="my-4 grid grid-cols-2 gap-4">
                        {/* CHANNEL 1 */}
                        <div className="grid gap-3">
                            {channel1Charts.slice(0, 4).map((series, i) => (
                                <ECGSignalChart
                                    key={`c1-${i}`}
                                    data={series}
                                    hr={series[0]}
                                    lead="Lead V2"
                                />
                            ))}
                        </div>

                        {/* CHANNEL 2 */}
                        <div className="grid gap-3">
                            {channel2Charts.slice(0, 4).map((series, i) => (
                                <ECGSignalChart
                                    key={`c2-${i}`}
                                    data={series}
                                    hr={series[0]}
                                    lead="Lead V5"
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </div>
    );
};

export default PdfContent;
