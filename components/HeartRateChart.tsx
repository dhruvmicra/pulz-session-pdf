"use client";
import * as d3 from "d3";
import React, { useRef, useState, useEffect } from "react";

type HeartRateChartProps = {
    data: number[];
};

const HeartRateChart: React.FC<HeartRateChartProps> = ({
    data
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [dimensions, setDimensions] = useState({
        width: 700,
        height: 600,
    });

    const margin = { top: 40, right: 30, bottom: 60, left: 40 };

    // ---- RESIZE LISTENER ----
    useEffect(() => {
        const resize = () => {
            if (!svgRef.current) return;
            const parentWidth = svgRef.current.parentElement?.offsetWidth || 700;
            const parentHeight = (parentWidth * 6) / 7;
            setDimensions({ width: parentWidth, height: parentHeight });
        };

        window.addEventListener("resize", resize);
        resize();

        return () => window.removeEventListener("resize", resize);
    }, []);

    // ---- MAIN DRAWING ----
    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3
            .select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height);

        const { width, height } = dimensions;

        // ---- FIND PEAK ----
        const peakValue = d3.max(data) ?? 0;
        const splitIndex = data.findIndex((v) => v === peakValue);
        const effectiveSplit =
            splitIndex !== -1 ? splitIndex : Math.floor(data.length / 2);

        // ---- SCALE CALC ----
        const dataMin = d3.min(data) ?? 0;
        const dataMax = d3.max(data) ?? 0;
        const yPad = (dataMax - dataMin) * 0.05;

        const finalYMin = Math.floor((dataMin - yPad) / 5) * 5;
        const finalYMax = Math.ceil((dataMax + yPad) / 5) * 5;

        const yScale = d3
            .scaleLinear()
            .domain([finalYMin, finalYMax])
            .nice(5)
            .range([height - margin.bottom, margin.top]);

        const xScale = d3
            .scaleLinear()
            .domain([0, data.length - 1])
            .range([margin.left, width - margin.right]);

        const exerciseColor = "#F66A67";
        const recoveryColor = "#73D673";

        // ==== BACKGROUND PHASE ZONES ====
        svg
            .append("rect")
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", xScale(effectiveSplit) - margin.left)
            .attr("height", height - margin.top - margin.bottom)
            .attr("fill", exerciseColor)
            .attr("opacity", 0.25);

        svg
            .append("rect")
            .attr("x", xScale(effectiveSplit))
            .attr("y", margin.top)
            .attr("width", width - margin.right - xScale(effectiveSplit))
            .attr("height", height - margin.top - margin.bottom)
            .attr("fill", recoveryColor)
            .attr("opacity", 0.25);

        // ==== AXES ====
        const yAxis = d3
            .axisLeft(yScale)
            .ticks(6)
            .tickSize(-(width - margin.left - margin.right))
            .tickFormat(d3.format("d"))
            .tickSizeOuter(0)
            .tickPadding(4);

        svg
            .append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(yAxis)
            .call((g) => g.select(".domain").remove())
            .call((g) =>
                g
                    .selectAll(".tick line")
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1)
                    .attr("opacity", 1)
            );

        const xTicks = d3
            .range(0, data.length, Math.ceil(data.length / 10))
            .filter((t) => Math.abs(t - effectiveSplit) > 1);

        const xAxis = d3
            .axisBottom(xScale)
            .tickValues(xTicks)
            .tickSize(-(height - margin.top - margin.bottom))
            .tickFormat(d3.format("d"))
            .tickSizeOuter(0)
            .tickPadding(4);

        svg
            .append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(xAxis)
            .call((g) => g.select(".domain").remove())
            .call((g) =>
                g
                    .selectAll(".tick line")
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1)
                    .attr("opacity", 1)
            );

        // Apply styles to axis text
        svg.selectAll(".tick text")
            .style("font-size", "6px")
            .style("font-family", "sans-serif");

        // ==== LINE PATH ====
        const line = d3
            .line<[number, number]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        svg
            .append("path")
            .datum(data.map((d, i) => [i, d] as [number, number]))
            .attr("fill", "none")
            .attr("stroke", "#C82121")
            .attr("stroke-width", 1.2)
            .attr("d", line);

        // ==== SPLIT LINE ====
        svg
            .append("line")
            .attr("x1", xScale(effectiveSplit))
            .attr("x2", xScale(effectiveSplit))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        // ==== BORDER ====
        svg
            .append("rect")
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", width - margin.left - margin.right)
            .attr("height", height - margin.top - margin.bottom)
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        // ==== AXIS LABELS ====
        svg
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.left / 2 - 12)
            .attr(
                "x",
                -(height -
                    margin.bottom -
                    (height - margin.top - margin.bottom) / 2)
            )
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", "8px")
            .style("font-weight", "bold")
            .text("Heart Rate");

        svg
            .append("text")
            .attr(
                "x",
                margin.left + (width - margin.left - margin.right) / 2
            )
            .attr("y", height - 35)
            .style("text-anchor", "middle")
            .style("font-size", "8px")
            .style("font-weight", "bold")
            .text("Time (Secs)");

        // ==== PHASE LABELS ====
        svg
            .append("rect")
            .attr("x", margin.left + 3)
            .attr("y", margin.top + 7)
            .attr("width", 38)
            .attr("height", 10)
            .attr("fill", "white")
            .attr("rx", 2)
            .attr("ry", 2);

        svg
            .append("text")
            .attr("x", margin.left + 7)
            .attr("y", margin.top + 15)
            .style("font-weight", "bold")
            .style("font-size", "8px")
            .style("fill", "#FF4C51")
            .text("Exercise");

        svg
            .append("rect")
            .attr("x", width - margin.right - 45)
            .attr("y", margin.top + 7)
            .attr("width", 40)
            .attr("height", 10)
            .attr("fill", "white")
            .attr("rx", 2)
            .attr("ry", 2);

        svg
            .append("text")
            .attr("x", width - margin.right - 8)
            .attr("y", margin.top + 15)
            .style("text-anchor", "end")
            .style("font-weight", "bold")
            .style("font-size", "8px")
            .style("fill", "#28C76F")
            .text("Recovery");

        // ==== INTERACTION ZONE ====
        svg
            .append("rect")
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", width - margin.left - margin.right)
            .attr("height", height - margin.top - margin.bottom)
            .attr("fill", "transparent")
            .attr("pointer-events", "all")
    }, [data, dimensions]);

    return (
        <div className="relative w-full">
            <svg
                ref={svgRef}
                className="w-full h-auto"
                preserveAspectRatio="xMidYMid meet"
            />
        </div>
    );
};

export default HeartRateChart;
