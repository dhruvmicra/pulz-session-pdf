"use client";
import * as d3 from "d3";
import React, { useRef, useState, useEffect } from "react";

type ECGChartProps = {
    data: number[];
    hr: number;
    lead: string;
};

const ECGSignalChart: React.FC<ECGChartProps> = ({ data, hr, lead }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [dimensions, setDimensions] = useState({
        width: 228.62,
        height: 102.57,
    });

    const margin = { top: 40, right: 20, bottom: 45, left: 35 };

    // ---------- AUTO RESIZE ----------
    useEffect(() => {
        const handleResize = () => {
            if (!svgRef.current) return;

            const parentWidth =
                svgRef.current.parentElement?.offsetWidth || 230;

            const parentHeight = (parentWidth * 4.5) / 7;

            setDimensions({
                width: parentWidth,
                height: parentHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // ---------- DRAW CHART ----------
    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = d3
            .select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height);

        svg.selectAll("*").remove();

        const { width, height } = dimensions;

        // SCALE SETUP
        const dataMin = d3.min(data) ?? 0;
        const dataMax = d3.max(data) ?? 0;
        const pad = (dataMax - dataMin) * 0.05;

        const finalYMin = Math.floor((dataMin - pad) / 5) * 5;
        const finalYMax = Math.ceil((dataMax + pad) / 5) * 5;

        const yScale = d3
            .scaleLinear()
            .domain([finalYMin, finalYMax])
            .nice(5)
            .range([height - margin.bottom, margin.top]);

        const xScale = d3
            .scaleLinear()
            .domain([0, data.length - 1])
            .range([margin.left, width - margin.right]);

        // AXES
        const yAxis = d3
            .axisLeft(yScale)
            .ticks(6)
            .tickSize(-(width - margin.left - margin.right))
            .tickFormat(d3.format("d"));

        const xTicks = d3.range(
            0,
            data.length,
            Math.ceil(data.length / 10)
        );

        const xAxis = d3
            .axisBottom(xScale)
            .tickValues(xTicks)
            .tickSize(-(height - margin.top - margin.bottom))
            .tickFormat(d3.format("d"));

        // Y AXIS
        svg
            .append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left}, 0)`)
            .call(yAxis)
            .call((g) => g.select(".domain").remove())
            .call((g) =>
                g
                    .selectAll(".tick line")
                    .attr("stroke", "#CFD1D4")
                    .attr("stroke-width", 1)
            )
            .call((g) => g.selectAll(".tick text").remove());

        // X AXIS
        svg
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${height - margin.bottom})`)
            .call(xAxis)
            .call((g) => g.select(".domain").remove())
            .call((g) =>
                g
                    .selectAll(".tick line")
                    .attr("stroke", "#CFD1D4")
                    .attr("stroke-width", 1)
            )
            .call((g) => g.selectAll(".tick text").remove());

        // GRID LINES
        const majorXGap =
            (width - margin.left - margin.right) / 10;
        const majorYGap =
            (height - margin.top - margin.bottom) / 6;

        const minorXGap = majorXGap / 5;
        const minorYGap = majorYGap / 5;

        for (let x = margin.left; x <= width - margin.right; x += minorXGap) {
            svg
                .append("line")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", margin.top)
                .attr("y2", height - margin.bottom)
                .attr("stroke", "#EAEAEA")
                .attr("stroke-width", 0.3);
        }

        for (let y = margin.top; y <= height - margin.bottom; y += minorYGap) {
            svg
                .append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right)
                .attr("y1", y)
                .attr("y2", y)
                .attr("stroke", "#EAEAEA")
                .attr("stroke-width", 0.3);
        }

        // ECG LINE
        const line = d3
            .line<[number, number]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        svg
            .append("path")
            .datum(data.map((v, i): [number, number] => [i, v]))
            .attr("fill", "none")
            .attr("stroke", "#E02D2D")
            .attr("stroke-width", 1.2)
            .attr("d", line);

        // BORDERS
        // Left border
        svg
            .append("line")
            .attr("x1", margin.left)
            .attr("x2", margin.left)
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#000")
            .attr("stroke-width", 0.5);

        // Bottom border
        svg
            .append("line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", height - margin.bottom)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#000")
            .attr("stroke-width", 0.5);

        // Right border
        svg
            .append("line")
            .attr("x1", width - margin.right)
            .attr("x2", width - margin.right)
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#CFD1D4")
            .attr("stroke-width", 1);
    }, [data, dimensions]);

    return (
        <div
            className="relative h-[142px] border border-gray-300 overflow-hidden w-full"
        >
            {/* TOP HEADER BAR */}
            <div className="absolute top-0 left-0 w-full bg-[#E5E5E5] px-[15px] py-[6px] flex justify-between items-center">
                <p className="text-[8px]">
                    HR: <span className="font-semibold text-black">{hr} bpm</span>
                </p>
                <p className="text-[8px] font-semibold">{lead}</p>
            </div>

            {/* SVG CHART (shifted down to avoid header overlap) */}
            <svg
                ref={svgRef}
                className="w-full h-auto"
                preserveAspectRatio="xMidYMid meet"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            />
        </div>
    );
};

export default ECGSignalChart;
