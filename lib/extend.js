/**
 * Deep clone an object.
 * Be careful, if define Object.prototype.clone here (which should be better), it will conflict with mongoose lib. Not investigated yet!
 */
Object.clone = function (source) {
    // Handle null or undefined or function
    if (!source || ("object" != typeof source) || (Object.keys(source).length <= 0))
        return source;

    // Handle the 3 simple types, Number and String and Boolean
    if (source instanceof Number || source instanceof String || source instanceof Boolean)
        return source.valueOf();

    // Handle Date
    if (source instanceof Date) {
        var copy = new Date();
        copy.setTime(source.getTime());
        return copy;
    }
    // Handle Array or Object
    if (Array.isArray(source)) {
        const copy = [];
        for (let i = 0; i < source.length; i += 1) {
            const attr = source[i];

            copy[i] = attr ? Object.clone(attr) : attr;
        }

        return copy;
    } else if (typeof source === 'object') {
        const copy = {};
        Object.keys(source).forEach(attr => {
            if (source.hasOwnProperty(attr) && !attr.startsWith('_') && !attr.startsWith('$'))
                copy[attr] = source[attr] ? Object.clone(source[attr]) : source[attr];
        })

        return copy;
    }

    // not support other types yet!
    throw new Error(`${typeof source} is not supported!`);
}


/**
 * Merge (deep) multiple objects into the target object.
 */
Object.merge = (target, ...source) => {
    const mg = (t, s) => {
        s = s || {};

        if(typeof t !== typeof s) return s;

        // not an object or is a regexp, assign source to target directly
        if (typeof t !== 'object' || typeof s !== 'object' || Object.prototype.toString.call(s) === '[object RegExp]') {
            t = s;
            return s;
        }

        Object.keys(s).forEach(k => {
            const sv = s[k];
            if (!Array.isArray(sv) && typeof sv === "object") {
                // Normal object, recursive merge
                t[k] = t[k] || {};
                t[k] = mg(t[k], sv);
            } else if (Array.isArray(sv)) {
                // Array, merge
                if (!Array.isArray(t[k])) {
                    t[k] = sv;
                } else {
                    let i = 0;
                    let list = [];
                    for (i = 0; i < sv.length; i += 1) {
                        t[k][i] = t[k][i] || {};
                        list[i] = mg(t[k][i], sv[i]);
                    }

                    t[k] = list;
                }
            } else {
                t[k] = sv;
            }
        });

        return t;
    };

    target = target || {};
    for (let i = 0; i < source.length; i += 1) {
        target = mg(target, source[i]);
    }

    return target;
};
Object.union = Object.merge;

/**
 * Get intersection (deep) of multiple objects.
 */

 Object.intersection = (target, ...source) => {
    const inter = (t, s) => {
        s = s || {};

        if(typeof t !== typeof s) return undefined;

        // not object, compare, remove when not equal
        if (typeof s !== 'object') {
            if(t === s) {
                return t;
            }

            return undefined;
        }

        // is a regexp, compare, remove when not equal
        if (Object.prototype.toString.call(s) === '[object RegExp]') {
            if(t.toString() === s.toString()) {
                return t;
            }

            return undefined;
        }

        const tt = {};
        Object.keys(s).forEach(k => {
            const sv = s[k];
            if (!Array.isArray(sv) && typeof sv === "object") {
                // Normal object, recursive intersection
                if(t[k]) {
                    t[k] = inter(t[k], sv);

                    // remove the key from target if nothing inner there
                    if(Object.keys(t[k]).filter(tk => t[k][tk] !== void 0).length <= 0) {
                        delete t[k];
                    }
                }
            } else if (Array.isArray(sv)) {
                // Array, get intersection
                if (!Array.isArray(t[k])) {
                    delete t[k];
                } else {
                    for (let i = 0; i < t[k].length; i += 1) {
                        if(sv[i]) {
                            t[k][i] = inter(t[k][i], sv[i]);

                            if(t[k][i] === void 0) {
                                delete t[k][i];
                            }
                        } else {
                            delete t[k][i];
                        }
                    }

                    // remove array with all undefined
                    if(t[k].filter(tkv => tkv !== void 0).length <= 0) {
                        delete t[k];
                    }
                }
            } else if (t[k] !== sv) {
                delete t[k];
            }

            if(t[k] !== void 0) {
                tt[k] = t[k];
            }
        });

        return tt;
    };

    target = target || {};
    for (let i = 0; i < source.length; i += 1) {
        target = inter(target, source[i]);
    }

    return target;
};

/**
 * Remove (deep complement) multiple objects from the target object.
 */
Object.complement = (target, ...source) => {
    const comp = (t, s) => {
        s = s || {};

        if(typeof t !== typeof s) return t;

        // not object, compare, remove when equal
        if (typeof s !== 'object') {
            if(t === s) {
                return undefined;
            }

            return t;
        }

        // source is a regexp, return target diretly
        if (Object.prototype.toString.call(s) === '[object RegExp]') {
            return t;
        }

        Object.keys(s).forEach(k => {
            const sv = s[k];
            if (!Array.isArray(sv) && typeof sv === "object") {
                // Normal object, recursive complement if the same key exists in target
                if(t[k]) {
                    t[k] = comp(t[k], sv);

                    // remove the key from target if nothing inner there
                    if(Object.keys(t[k]).filter(tk => t[k][tk] !== void 0).length <= 0) {
                        delete t[k];
                    }
                }
            } else if (Array.isArray(sv)) {
                // Array, get complement
                if (Array.isArray(t[k])) {
                    for (let i = 0; i < sv.length; i += 1) {
                        if(t[k][i]) {
                            t[k][i] = comp(t[k][i], sv[i]);
                        }
                    }

                    // remove array with all undefined
                    if(t[k].filter(tkv => tkv !== void 0).length <= 0) {
                        delete t[k];
                    }
                }
            } else {
                // not object and array, remove key from target only when the value is exactly same
                if(t[k] === sv) {
                    delete t[k];
                }
            }
        });

        return t;
    };

    target = target || {};
    for (let i = 0; i < source.length; i += 1) {
        target = comp(target, source[i]);
    }

    return target;
}

Object.hasValue = (o) => {
    if ([undefined, null].indexOf(o) >= 0) return false;

    if (typeof o !== 'object' && !!o) return true;

    if (typeof o === 'object') {
        for (let j = 0; j < Object.keys(o).length; j += 1) {
            if (Object.hasValue(o[Object.keys(o)[j]])) return true;
        }
    }

    return false;
};

Object.nestValue = (obj, p) => {
    if (!obj || !p) return undefined;

    if (p === '.') return obj;

    let v = obj;
    const pList = p.split('.');

    for (let i = 0; i < pList.length; i += 1) {
        const pl = pList[i];

        if (v[pl]) v = v[pl];
        else { return undefined; }
    }

    return v;
};

Object.setValue = (obj, n, v) => {
    if (!obj || !n) return undefined;

    let t = obj;
    const nList = n.split('.');
    for (let i = 0; i < nList.length; i += 1) {
        const nl = nList[i];

        if (i < nList.length - 1) {
            if (!t[nl]) {
                t[nl] = typeof nList[i + 1] === 'number' ? [] : {};
            }
            t = t[nl];
        } else {
            t[nl] = v;
        }
    }

    return obj;
};

RegExp.quote = (str, attrs) => new RegExp(str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1"), attrs || '');